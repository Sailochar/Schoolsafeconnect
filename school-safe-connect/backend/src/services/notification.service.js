/**
 * Centralized Event-Driven Notification Engine
 * Orchestrates In-App, Push (FCM), WhatsApp, and SMS delivery according to event priority levels.
 *
 * Design:
 * - Every operation is tenant-scoped by schoolCode.
 * - sendDirectNotification creates a Notification (QUEUED), emits IN_APP via socket.io
 *   to the recipient user room, marks IN_APP SENT, then enqueues outbound channel jobs.
 * - The notification queue worker processes PUSH/WHATSAPP/SMS jobs with retry/backoff/DLQ.
 * - Preferences (channel toggles, quiet hours) are respected; CRITICAL bypasses quiet
 *   hours and is never fully suppressed (IN_APP always delivered).
 */

const { v4: uuidv4 } = require("uuid");
const {
  Notification,
  Device,
  User,
  Student,
  ParentStudentLink,
  NotificationPreference
} = require("../models");
const {
  NOTIFICATION_CHANNELS,
  NOTIFICATION_PRIORITY,
  NOTIFICATION_CHANNEL_STATUS,
  NOTIFICATION_STATUS,
  ROLES
} = require("../config/constants");
const NotificationQueueService = require("./notificationQueue.service");
const ioUtil = require("../utils/io");
const config = require("../config/env");
const logger = require("../utils/logger");

const DEFAULT_PREFERENCE = {
  emailEnabled: true,
  smsEnabled: true,
  pushEnabled: true,
  whatsappEnabled: true,
  quietHours: { enabled: false, startTime: "22:00", endTime: "06:00" }
};

function isQuietHoursActive(preference) {
  if (!preference || !preference.quietHours || !preference.quietHours.enabled) {
    return false;
  }
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const parseTime = (t) => {
    const parts = String(t || "").split(":");
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
  };
  const start = parseTime(preference.quietHours.startTime);
  const end = parseTime(preference.quietHours.endTime);
  if (start < end) {
    return nowMinutes >= start && nowMinutes < end;
  }
  // Overnight window (e.g. 22:00 to 06:00)
  return nowMinutes >= start || nowMinutes < end;
}

async function hasActiveFcmToken(schoolCode, userCode) {
  const count = await Device.countDocuments({
    schoolCode,
    userCode,
    isActive: true,
    fcmToken: { $exists: true, $ne: "" }
  });
  return count > 0;
}

function hasPhone(user) {
  return Boolean(user && user.phone);
}

class NotificationService {
  /**
   * Resolve the channels to attempt for a recipient, filtered by priority mapping,
   * preference toggles, quiet hours (unless CRITICAL), and channel availability.
   * Returns { channels: string[], channelsDispatched: [...] }.
   * IN_APP is always included and never suppressed.
   */
  static resolveChannels(priority, preference, recipient) {
    const pref = preference || DEFAULT_PREFERENCE;
    const baseChannels = NOTIFICATION_CHANNELS[priority] || NOTIFICATION_CHANNELS.NORMAL;
    const bypassQuiet = priority === NOTIFICATION_PRIORITY.CRITICAL;
    const quiet = isQuietHoursActive(pref);

    const channelsDispatched = [];
    const attemptable = [];

    for (const channel of baseChannels) {
      let enabled = true;
      let skipReason = null;

      if (channel === "IN_APP") {
        enabled = true; // always delivered in-app
      } else if (quiet && !bypassQuiet) {
        enabled = false;
        skipReason = "quiet_hours";
      } else if (channel === "SMS") {
        enabled = Boolean(pref.smsEnabled && hasPhone(recipient));
        if (!hasPhone(recipient)) {skipReason = "no_phone";}
      } else if (channel === "WHATSAPP") {
        enabled = Boolean(pref.whatsappEnabled && hasPhone(recipient));
        if (!hasPhone(recipient)) {skipReason = "no_phone";}
      } else if (channel === "PUSH") {
        enabled = Boolean(pref.pushEnabled);
      } else {
        enabled = Boolean(pref.emailEnabled);
      }

      channelsDispatched.push({
        channel,
        status: enabled ? NOTIFICATION_CHANNEL_STATUS.QUEUED : NOTIFICATION_CHANNEL_STATUS.SKIPPED,
        skipReason
      });

      if (enabled && channel !== "IN_APP") {
        attemptable.push(channel);
      }
    }

    return { channels: attemptable, channelsDispatched };
  }

  /**
   * Dispatch a direct notification to a specific user.
   * Signature preserved for callers (assignmentNotice, incidentPanic, transport, auth flows).
   */
  static async sendDirectNotification({
    schoolCode,
    recipientUserCode,
    title,
    message,
    eventType,
    priority = NOTIFICATION_PRIORITY.NORMAL,
    metadata = {},
    idempotencyKey
  } = {}) {
    if (!schoolCode || !recipientUserCode || !title || !message || !eventType) {
      const err = new Error("schoolCode, recipientUserCode, title, message, and eventType are required.");
      err.statusCode = 400;
      throw err;
    }

    // Idempotency: return existing notification if already created with this key.
    if (idempotencyKey) {
      const existing = await Notification.findOne({
        schoolCode,
        recipientUserCode,
        idempotencyKey
      });
      if (existing) {return existing;}
    }

    const recipient = await User.findOne({
      schoolCode,
      userCode: recipientUserCode,
      status: "ACTIVE"
    }).lean();

    const preference = (await NotificationPreference.findOne({
      schoolCode,
      userCode: recipientUserCode
    }).lean()) || DEFAULT_PREFERENCE;

    const { channels, channelsDispatched } = this.resolveChannels(priority, preference, recipient);

    // Push availability: mark PUSH SKIPPED if no active FCM token.
    const pushIndex = channelsDispatched.findIndex((c) => c.channel === "PUSH");
    if (pushIndex !== -1 && channelsDispatched[pushIndex].status === NOTIFICATION_CHANNEL_STATUS.QUEUED) {
      const hasToken = await hasActiveFcmToken(schoolCode, recipientUserCode);
      if (!hasToken) {
        channelsDispatched[pushIndex].status = NOTIFICATION_CHANNEL_STATUS.SKIPPED;
        channelsDispatched[pushIndex].skipReason = "no_fcm_token";
        channels.splice(channels.indexOf("PUSH"), 1);
      }
    }

    const notificationId = `NOTIF-${Date.now()}-${uuidv4().substring(0, 8)}`;
    const notification = new Notification({
      schoolCode,
      notificationId,
      recipientUserCode,
      title,
      message,
      eventType,
      priority,
      channelsDispatched,
      status: NOTIFICATION_STATUS.QUEUED,
      metadata,
      idempotencyKey,
      maxRetries: config.NOTIFICATION.MAX_RETRIES || 3
    });

    await notification.save();

    // IN_APP delivery: emit real-time socket event to recipient user room, then mark SENT/DELIVERED.
    const inAppIndex = channelsDispatched.findIndex((c) => c.channel === "IN_APP");
    if (inAppIndex !== -1) {
      await this._emitInApp(notification, recipient);
      try {
        await Notification.updateOne(
          { _id: notification._id, "channelsDispatched.channel": "IN_APP" },
          {
            $set: {
              "channelsDispatched.$.status": NOTIFICATION_CHANNEL_STATUS.SENT,
              "channelsDispatched.$.sentAt": new Date(),
              "channelsDispatched.$.deliveredAt": new Date()
            }
          }
        );
      } catch (updateErr) {
        logger.warn(`[NotificationService] IN_APP status update failed: ${updateErr.message}`);
      }
    }

    // Enqueue outbound channel jobs (PUSH / WHATSAPP / SMS). IN_APP is already handled.
    const outboundChannels = channelsDispatched
      .filter((c) => c.status === NOTIFICATION_CHANNEL_STATUS.QUEUED && c.channel !== "IN_APP")
      .map((c) => c.channel);

    if (outboundChannels.length) {
      await NotificationQueueService.enqueueNotification(notification._id, {
        channels: outboundChannels,
        attempt: 0
      });
    }

    // Recompute overall status.
    await this._recomputeStatus(notification);

    logger.info(
      `[NotificationService] sendDirectNotification ${notification.notificationId} to ${recipientUserCode} (${schoolCode}) channels=${JSON.stringify(channelsDispatched.map((c) => `${c.channel}:${c.status}`))}`
    );

    return notification;
  }

  /**
   * Generic event dispatcher. Routes to sendDirectNotification with tenant scoping.
   */
  static async dispatchEvent({
    eventType,
    schoolCode,
    recipientUserCode,
    title,
    message,
    priority = NOTIFICATION_PRIORITY.NORMAL,
    metadata = {}
  } = {}) {
    return this.sendDirectNotification({
      schoolCode,
      recipientUserCode,
      title,
      message,
      eventType,
      priority,
      metadata
    });
  }

  /**
   * Dispatch a broadcast notification to verified parents of students in a class.
   * Batched/chunked to avoid huge in-memory fanout; allSettled semantics.
   */
  static async notifyClassParents({ schoolCode, classCode, title, message, eventType, priority, metadata = {} } = {}) {
    if (!schoolCode || !classCode) {return;}

    const students = await Student.find({
      schoolCode,
      classCode,
      status: "ACTIVE"
    }).select("studentCode").lean();
    const studentCodes = students.map((s) => s.studentCode);
    if (!studentCodes.length) {return;}

    const links = await ParentStudentLink.find({
      schoolCode,
      studentCode: { $in: studentCodes },
      status: "VERIFIED"
    }).select("parentCode").lean();

    const uniqueParentCodes = [...new Set(links.map((l) => l.parentCode))];
    if (!uniqueParentCodes.length) {return;}

    const batchSize = config.NOTIFICATION.BATCH_SIZE || 20;
    for (let i = 0; i < uniqueParentCodes.length; i += batchSize) {
      const chunk = uniqueParentCodes.slice(i, i + batchSize);
      await Promise.allSettled(
        chunk.map((parentCode) =>
          this.sendDirectNotification({
            schoolCode,
            recipientUserCode: parentCode,
            title,
            message,
            eventType,
            priority,
            metadata
          }).catch((err) => logger.warn(`[NotificationService] notifyClassParents failed for ${parentCode}: ${err.message}`))
        )
      );
      if (i + batchSize < uniqueParentCodes.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    logger.info(`[NotificationService] Notified ${uniqueParentCodes.length} parents in class ${classCode} for ${eventType}`);
  }

  /**
   * Broadcast a published Notice to targeted school roles and classes.
   * Tenant-safe, preference-aware, batched. eventType NOTICE_PUBLISHED.
   * notice may be a mongoose doc (toObject()) or plain object.
   */
  static async dispatchNoticeNotifications({ schoolCode, notice } = {}) {
    if (!schoolCode || !notice) {return;}

    const noticeObj = notice.toObject ? notice.toObject() : notice;
    const targetRoles = Array.isArray(noticeObj.targetRoles) && noticeObj.targetRoles.length
      ? noticeObj.targetRoles
      : Object.values(ROLES);
    const classCodes = Array.isArray(noticeObj.classCodes) ? noticeObj.classCodes.filter(Boolean) : [];
    const recipientCodes = new Set();

    if (targetRoles.includes(ROLES.PARENT)) {
      if (classCodes.length) {
        const students = await Student.find({
          schoolCode,
          classCode: { $in: classCodes },
          status: "ACTIVE"
        }).select("studentCode").lean();
        const studentCodes = students.map((s) => s.studentCode);
        if (studentCodes.length) {
          const links = await ParentStudentLink.find({
            schoolCode,
            studentCode: { $in: studentCodes },
            status: "VERIFIED"
          }).select("parentCode").lean();
          links.forEach((l) => recipientCodes.add(l.parentCode));
        }
      } else {
        const parents = await User.find({ schoolCode, role: ROLES.PARENT, status: "ACTIVE" }).select("userCode").lean();
        parents.forEach((u) => recipientCodes.add(u.userCode));
      }
    }

    const staffRoles = targetRoles.filter((r) => r !== ROLES.PARENT);
    if (staffRoles.length) {
      const staff = await User.find({
        schoolCode,
        role: { $in: staffRoles },
        status: "ACTIVE"
      }).select("userCode").lean();
      staff.forEach((u) => recipientCodes.add(u.userCode));
    }

    const uniqueRecipients = [...recipientCodes];
    const batchSize = config.NOTIFICATION.BATCH_SIZE || 20;
    for (let i = 0; i < uniqueRecipients.length; i += batchSize) {
      const chunk = uniqueRecipients.slice(i, i + batchSize);
      await Promise.allSettled(
        chunk.map((userCode) =>
          this.sendDirectNotification({
            schoolCode,
            recipientUserCode: userCode,
            title: noticeObj.title,
            message: String(noticeObj.content || "").substring(0, 500),
            eventType: "NOTICE_PUBLISHED",
            priority: noticeObj.priority || NOTIFICATION_PRIORITY.NORMAL,
            metadata: { noticeCode: noticeObj.noticeCode }
          }).catch((err) => logger.warn(`[NotificationService] dispatchNoticeNotifications failed for ${userCode}: ${err.message}`))
        )
      );
      if (i + batchSize < uniqueRecipients.length) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    logger.info(`[NotificationService] Dispatched notice ${noticeObj.noticeCode} to ${uniqueRecipients.length} recipients`);
  }

  /**
   * Broadcast urgent alert to School Admin and Transport Coordinator in the tenant.
   * CRITICAL priority; bypasses quiet hours; never fully suppressed.
   */
  static async alertSafetyStakeholders({ schoolCode, title, message, eventType, metadata = {} } = {}) {
    if (!schoolCode) {return;}

    const stakeholders = await User.find({
      schoolCode,
      role: { $in: [ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR] },
      status: "ACTIVE"
    }).select("userCode").lean();

    await Promise.allSettled(
      stakeholders.map((user) =>
        this.sendDirectNotification({
          schoolCode,
          recipientUserCode: user.userCode,
          title,
          message,
          eventType,
          priority: NOTIFICATION_PRIORITY.CRITICAL,
          metadata
        }).catch((err) => logger.warn(`[NotificationService] alertSafetyStakeholders failed for ${user.userCode}: ${err.message}`))
      )
    );
  }

  /* ------------------------------------------------------------------ */
  /* User-facing helpers                                                */
  /* ------------------------------------------------------------------ */

  static async getPreferences(schoolCode, userCode) {
    if (!schoolCode || !userCode) {return null;}
    const pref = await NotificationPreference.findOne({ schoolCode, userCode }).lean();
    return pref || { ...DEFAULT_PREFERENCE, schoolCode, userCode };
  }

  static async updatePreferences(schoolCode, userCode, updates = {}) {
    const allowed = ["emailEnabled", "smsEnabled", "pushEnabled", "whatsappEnabled", "quietHours"];
    const set = {};
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        set[key] = updates[key];
      }
    }
    return NotificationPreference.findOneAndUpdate(
      { schoolCode, userCode },
      { $set: set },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  }

  static async markRead({ schoolCode, notificationId, userCode }) {
    if (!schoolCode || !notificationId || !userCode) {
      const err = new Error("schoolCode, notificationId, and userCode are required.");
      err.statusCode = 400;
      throw err;
    }
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        schoolCode,
        recipientUserCode: userCode
      },
      {
        $set: { status: NOTIFICATION_STATUS.READ, readAt: new Date() }
      },
      { new: true }
    ).lean();
    if (!notification) {
      const err = new Error("Notification not found or not accessible.");
      err.statusCode = 404;
      throw err;
    }
    return notification;
  }

  static async markReadAll({ schoolCode, userCode }) {
    if (!schoolCode || !userCode) {
      const err = new Error("schoolCode and userCode are required.");
      err.statusCode = 400;
      throw err;
    }
    return Notification.updateMany(
      {
        schoolCode,
        recipientUserCode: userCode,
        status: { $ne: NOTIFICATION_STATUS.READ }
      },
      {
        $set: { status: NOTIFICATION_STATUS.READ, readAt: new Date() }
      }
    );
  }

  static async markDelivered({ schoolCode, notificationId, userCode, channel }) {
    if (!schoolCode || !notificationId || !userCode || !channel) {
      const err = new Error("schoolCode, notificationId, userCode, and channel are required.");
      err.statusCode = 400;
      throw err;
    }
    const notification = await Notification.findOneAndUpdate(
      {
        _id: notificationId,
        schoolCode,
        recipientUserCode: userCode,
        "channelsDispatched.channel": channel
      },
      {
        $set: {
          "channelsDispatched.$.status": NOTIFICATION_CHANNEL_STATUS.DELIVERED,
          "channelsDispatched.$.deliveredAt": new Date(),
          deliveredAt: new Date()
        }
      },
      { new: true }
    ).lean();
    if (!notification) {
      const err = new Error("Notification or channel not found.");
      err.statusCode = 404;
      throw err;
    }
    return notification;
  }

  static async getUserNotifications({ schoolCode, userCode, page = 1, limit = 50, status, eventType, unread }) {
    if (!schoolCode || !userCode) {
      const err = new Error("schoolCode and userCode are required.");
      err.statusCode = 400;
      throw err;
    }
    const query = { schoolCode, recipientUserCode: userCode };
    if (status) {query.status = status;}
    if (eventType) {query.eventType = eventType;}
    if (unread === true) {
      query.status = { $ne: NOTIFICATION_STATUS.READ };
    } else if (unread === false) {
      query.status = NOTIFICATION_STATUS.READ;
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * Math.min(parseInt(limit, 10) || 50, 100);
    const limitNum = Math.min(parseInt(limit, 10) || 50, 100);

    const [notifications, total] = await Promise.all([
      Notification.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
      Notification.countDocuments(query)
    ]);
    return { notifications, total, page: Math.max(1, parseInt(page, 10)), limit: limitNum };
  }

  static async getUnreadCount({ schoolCode, userCode }) {
    if (!schoolCode || !userCode) {
      const err = new Error("schoolCode and userCode are required.");
      err.statusCode = 400;
      throw err;
    }
    return Notification.countDocuments({
      schoolCode,
      recipientUserCode: userCode,
      status: { $ne: NOTIFICATION_STATUS.READ }
    });
  }

  static async registerDevice({ schoolCode, userCode, deviceId, fcmToken, deviceModel, osVersion, appVersion, platform }) {
    if (!schoolCode || !userCode || !deviceId) {
      const err = new Error("schoolCode, userCode, and deviceId are required.");
      err.statusCode = 400;
      throw err;
    }
    return Device.findOneAndUpdate(
      { schoolCode, userCode, deviceId },
      {
        $set: {
          fcmToken: fcmToken || null,
          deviceModel: deviceModel || "Unknown",
          osVersion: osVersion || "Unknown",
          appVersion: appVersion || "Unknown",
          platform: platform || "unknown",
          isActive: true,
          lastSeenAt: new Date(),
          lastActiveAt: new Date()
        }
      },
      { upsert: true, new: true }
    ).lean();
  }

  static async unregisterDevice({ schoolCode, userCode, deviceId }) {
    if (!schoolCode || !userCode || !deviceId) {
      const err = new Error("schoolCode, userCode, and deviceId are required.");
      err.statusCode = 400;
      throw err;
    }
    return Device.findOneAndUpdate(
      { schoolCode, userCode, deviceId },
      { $set: { isActive: false, fcmToken: null, lastSeenAt: new Date() } },
      { new: true }
    ).lean();
  }

  /* ------------------------------------------------------------------ */
  /* Internal                                                           */
  /* ------------------------------------------------------------------ */

  static async _emitInApp(notification) {
    const io = ioUtil.getIo();
    if (!io) {
      logger.warn("[NotificationService] Socket.IO not available; IN_APP event not emitted.");
      return;
    }
    const room = `tenant_${notification.schoolCode}_user_${notification.recipientUserCode}`;
    const payload = {
      notificationId: notification.notificationId,
      schoolCode: notification.schoolCode,
      recipientUserCode: notification.recipientUserCode,
      title: notification.title,
      message: notification.message,
      eventType: notification.eventType,
      priority: notification.priority,
      createdAt: notification.createdAt,
      metadata: notification.metadata
    };
    io.to(room).emit("notification:new", payload);
    io.to(`tenant_${notification.schoolCode}`).emit("notification:tenant", {
      ...payload,
      recipientUserCode: undefined
    });
  }

  static async _recomputeStatus(notification) {
    const entries = notification.channelsDispatched || [];
    if (entries.length === 0) {return;}

    const allSentOrDelivered = entries.every((e) => e.status === "SENT" || e.status === "DELIVERED");
    const allDelivered = entries.every((e) => e.status === "DELIVERED");
    const allSkipped = entries.every((e) => e.status === "SKIPPED");
    const anyFailed = entries.some((e) => e.status === "FAILED");
    const anyPending = entries.some((e) => e.status === "PENDING" || e.status === "QUEUED");

    let status;
    if (allSkipped) {
      status = NOTIFICATION_STATUS.SENT;
    } else if (allDelivered) {
      status = NOTIFICATION_STATUS.DELIVERED;
      notification.deliveredAt = new Date();
    } else if (allSentOrDelivered) {
      status = NOTIFICATION_STATUS.SENT;
    } else if (anyFailed && !anyPending) {
      status = NOTIFICATION_STATUS.FAILED;
    } else if (anyFailed) {
      status = NOTIFICATION_STATUS.PARTIAL;
    } else {
      status = NOTIFICATION_STATUS.QUEUED;
    }

    notification.status = status;
    await notification.save();
  }
}

module.exports = NotificationService;
