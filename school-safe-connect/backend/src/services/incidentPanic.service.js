/**
 * Incident and Panic Alert Service
 * Manages safety lifecycle, critical SOS triggers, misuse controls, and automated incident response escalation.
 * All operations are tenant-scoped via schoolCode (never trusted from client).
 */

const { Incident, PanicAlert, User, Student, ParentStudentLink, ClassTeacher } = require("../models");
const IdGeneratorService = require("./idGenerator.service");
const AuditService = require("./audit.service");
const NotificationService = require("./notification.service");
const redisWrapper = require("../config/redis");
const {
  INCIDENT_TYPES,
  INCIDENT_STATUS,
  PANIC_ALERT_STATUS,
  ROLES,
  NOTIFICATION_PRIORITY
} = require("../config/constants");
const logger = require("../utils/logger");

// Panic misuse control constants
const PANIC_RATE_LIMIT_WINDOW_SECONDS = 600; // 10 minutes
const PANIC_MAX_TRIGGERS_PER_WINDOW = 3;
const PANIC_COOLDOWN_SECONDS = 300; // 5 minutes

// Enforced incident status flow: OPEN -> ACKNOWLEDGED -> IN_PROGRESS -> RESOLVED -> CLOSED
const INCIDENT_TRANSITIONS = {
  [INCIDENT_STATUS.OPEN]: [INCIDENT_STATUS.ACKNOWLEDGED],
  [INCIDENT_STATUS.ACKNOWLEDGED]: [INCIDENT_STATUS.IN_PROGRESS],
  [INCIDENT_STATUS.IN_PROGRESS]: [INCIDENT_STATUS.RESOLVED],
  [INCIDENT_STATUS.RESOLVED]: [INCIDENT_STATUS.CLOSED],
  [INCIDENT_STATUS.CLOSED]: []
};

// Enforced panic alert status flow
const PANIC_TRANSITIONS = {
  [PANIC_ALERT_STATUS.TRIGGERED]: [
    PANIC_ALERT_STATUS.ACKNOWLEDGED,
    PANIC_ALERT_STATUS.IN_PROGRESS,
    PANIC_ALERT_STATUS.RESOLVED,
    PANIC_ALERT_STATUS.FALSE_ALARM
  ],
  [PANIC_ALERT_STATUS.ACKNOWLEDGED]: [
    PANIC_ALERT_STATUS.IN_PROGRESS,
    PANIC_ALERT_STATUS.RESOLVED,
    PANIC_ALERT_STATUS.FALSE_ALARM
  ],
  [PANIC_ALERT_STATUS.IN_PROGRESS]: [PANIC_ALERT_STATUS.RESOLVED, PANIC_ALERT_STATUS.FALSE_ALARM],
  [PANIC_ALERT_STATUS.RESOLVED]: [],
  [PANIC_ALERT_STATUS.FALSE_ALARM]: []
};

const MIN_REMARK_LENGTH = 5;

class IncidentPanicService {
  /* ------------------------------------------------------------------ */
  // Incident reporting
  /* ------------------------------------------------------------------ */

  /**
   * Reports an incident manually.
   * School Admin, Transport Coordinator, Teachers, and optionally Parents may report.
   * Parents are scoped to their own child's class/bus context.
   */
  static async reportIncident({
    schoolCode,
    reporterUser,
    type,
    severity = "MEDIUM",
    classCode,
    busId,
    description,
    attachments = [],
    ipAddress,
    userAgent,
    options = {}
  }) {
    const userCode = reporterUser.userCode;
    const role = reporterUser.role;

    // Parent scoping: parents may only report for their own child's class/bus context
    if (role === ROLES.PARENT) {
      if (!classCode && !busId) {
        const err = new Error("Parents must report an incident against a class or bus context.");
        err.statusCode = 400;
        throw err;
      }
      if (classCode) {
        await this._assertParentLinkedToClass({ schoolCode, parentCode: userCode, classCode });
      }
    }

    // Class teachers may only report against their assigned class
    if (role === ROLES.CLASS_TEACHER && classCode) {
      await this._assertClassTeacherAssigned({ schoolCode, teacherCode: userCode, classCode });
    }

    const incidentCode = await IdGeneratorService.generateIncidentCode(schoolCode);

    const incident = new Incident({
      schoolCode,
      incidentCode,
      type,
      severity,
      reportedBy: userCode,
      classCode: classCode || undefined,
      busId: busId || undefined,
      description,
      attachments: Array.isArray(attachments) ? attachments.slice(0, 10) : [],
      status: INCIDENT_STATUS.OPEN,
      source: "MANUAL_REPORT",
      statusHistory: [
        {
          status: INCIDENT_STATUS.OPEN,
          changedBy: userCode,
          changedAt: new Date(),
          remarks: "Incident initial report",
          ipAddress,
          userAgent
        }
      ]
    });

    await incident.save();

    if (!options.skipStakeholderNotification) {
      const priority = severity === "CRITICAL" ? NOTIFICATION_PRIORITY.CRITICAL : NOTIFICATION_PRIORITY.IMPORTANT;
      await NotificationService.alertSafetyStakeholders({
        schoolCode,
        title: `Incident Reported: ${type} [${severity}]`,
        message: `Incident ${incidentCode}: ${description.substring(0, 150)}`,
        eventType: "INCIDENT_REPORTED",
        priority,
        metadata: { incidentCode, severity, type, classCode, busId, reportedBy: userCode }
      }).catch((err) => logger.warn(`Incident stakeholder notification failed: ${err.message}`));

      if (classCode) {
        await this._notifyClassTeacher({
          schoolCode,
          classCode,
          title: `Incident Reported: ${type} [${severity}]`,
          message: `Incident ${incidentCode}: ${description.substring(0, 150)}`,
          eventType: "INCIDENT_REPORTED",
          priority,
          metadata: { incidentCode, classCode, severity }
        }).catch((err) => logger.warn(`Class teacher incident notification failed: ${err.message}`));
      }
    }

    await AuditService.log({
      schoolCode,
      actor: {
        userCode: reporterUser.userCode,
        role: reporterUser.role,
        fullName: reporterUser.fullName,
        email: reporterUser.email
      },
      action: "INCIDENT_REPORTED",
      resourceType: "INCIDENT",
      resourceId: incidentCode,
      reason: description,
      ipAddress,
      userAgent,
      metadata: { type, severity, classCode, busId, source: "MANUAL_REPORT" }
    });

    return incident;
  }

  /**
   * Updates an incident status with mandatory remarks and enforced transition flow.
   * Every change appends an immutable status history entry with actor/IP/UA.
   */
  static async updateIncidentStatus({
    schoolCode,
    incidentCode,
    status,
    remarks,
    updaterUser,
    ipAddress,
    userAgent
  }) {
    if (!remarks || remarks.trim().length < MIN_REMARK_LENGTH) {
      const err = new Error(`Remarks are mandatory when changing incident status (minimum ${MIN_REMARK_LENGTH} characters).`);
      err.statusCode = 400;
      throw err;
    }

    const incident = await Incident.findOne({ schoolCode, incidentCode });
    if (!incident) {
      const err = new Error(`Incident [${incidentCode}] not found.`);
      err.statusCode = 404;
      throw err;
    }

    const allowed = INCIDENT_TRANSITIONS[incident.status] || [];
    if (!allowed.includes(status)) {
      const err = new Error(`Invalid incident status transition from [${incident.status}] to [${status}].`);
      err.statusCode = 409;
      throw err;
    }

    const previousStatus = incident.status;
    const trimmedRemarks = remarks.trim();

    incident.status = status;
    incident.statusHistory.push({
      status,
      changedBy: updaterUser.userCode,
      changedAt: new Date(),
      remarks: trimmedRemarks,
      ipAddress,
      userAgent
    });

    if (status === INCIDENT_STATUS.RESOLVED || status === INCIDENT_STATUS.CLOSED) {
      incident.resolvedBy = updaterUser.userCode;
      incident.resolvedAt = new Date();
    }

    await incident.save();

    await AuditService.log({
      schoolCode,
      actor: {
        userCode: updaterUser.userCode,
        role: updaterUser.role,
        fullName: updaterUser.fullName,
        email: updaterUser.email
      },
      action: "INCIDENT_STATUS_CHANGED",
      resourceType: "INCIDENT",
      resourceId: incidentCode,
      reason: trimmedRemarks,
      ipAddress,
      userAgent,
      metadata: { previousStatus, newStatus: status }
    });

    return incident;
  }

  /* ------------------------------------------------------------------ */
  // Panic / SOS
  /* ------------------------------------------------------------------ */

  /**
   * Triggers Emergency Panic / SOS Alert.
   * Misuse controls: explicit confirmation, per-user rate limit + cooldown,
   * full audit of all attempts (including rejected/throttled).
   * Bypasses all parent query throttling (this module is independent of ParentQuery limits).
   */
  static async triggerPanicAlert({
    schoolCode,
    triggerUser,
    confirmed,
    location,
    remarks,
    classCode,
    busId,
    ipAddress,
    userAgent
  }) {
    const userCode = triggerUser.userCode;
    const role = triggerUser.role;

    // Confirmation step: client confirmation must be validated server-side
    if (confirmed !== true) {
      await AuditService.log({
        schoolCode,
        actor: {
          userCode,
          role,
          fullName: triggerUser.fullName,
          email: triggerUser.email
        },
        action: "PANIC_CONFIRMATION_REJECTED",
        resourceType: "PANIC_ALERT",
        resourceId: null,
        reason: "Panic trigger attempt without explicit client confirmation",
        ipAddress,
        userAgent,
        metadata: { location, classCode, busId }
      });
      const err = new Error("Panic alert requires explicit confirmation (confirmed: true).");
      err.statusCode = 400;
      throw err;
    }

    // Misuse controls: cooldown check first, then rate-limit counter
    await this.enforcePanicMisuseControls({ schoolCode, userCode, ipAddress, userAgent });

    const alertCode = await IdGeneratorService.generatePanicAlertCode(schoolCode);
    const incidentCode = await IdGeneratorService.generateIncidentCode(schoolCode);

    const description = `AUTOMATED SOS PANIC ALERT triggered by ${triggerUser.fullName} (${userCode}, ${role}). ${remarks || "Immediate emergency assistance requested."}`;

    // 1. Auto-create linked CRITICAL incident (notification skipped here; panic broadcast covers it)
    const linkedIncident = new Incident({
      schoolCode,
      incidentCode,
      type: INCIDENT_TYPES.SECURITY_ISSUE,
      severity: "CRITICAL",
      reportedBy: userCode,
      classCode: classCode || undefined,
      busId: busId || undefined,
      description,
      status: INCIDENT_STATUS.OPEN,
      source: "PANIC_AUTO",
      linkedPanicAlertCode: alertCode,
      statusHistory: [
        {
          status: INCIDENT_STATUS.OPEN,
          changedBy: userCode,
          changedAt: new Date(),
          remarks: "Auto-created from panic alert (SOS)",
          ipAddress,
          userAgent
        }
      ]
    });
    await linkedIncident.save();

    // 2. Create Panic Alert record
    const panicAlert = new PanicAlert({
      schoolCode,
      alertCode,
      triggeredBy: userCode,
      userRole: role,
      location: location || {},
      incidentId: incidentCode,
      priority: "CRITICAL",
      status: PANIC_ALERT_STATUS.TRIGGERED,
      confirmationVerified: true,
      triggerCount: 1,
      channelsNotified: [],
      remarks: remarks || "SOS Triggered",
      ipAddress,
      userAgent,
      statusHistory: [
        {
          status: PANIC_ALERT_STATUS.TRIGGERED,
          changedBy: userCode,
          changedAt: new Date(),
          remarks: remarks || "SOS Triggered",
          ipAddress,
          userAgent
        }
      ]
    });
    await panicAlert.save();

    // 3. Multi-channel CRITICAL broadcast to School Admin and Transport Coordinator
    const priority = NOTIFICATION_PRIORITY.CRITICAL;
    const title = `EMERGENCY SOS ALERT: ${triggerUser.fullName}`;
    const message = `CRITICAL ALERT ${alertCode} triggered by ${role} ${triggerUser.fullName}. Immediate intervention required. Incident: ${incidentCode}`;
    await NotificationService.alertSafetyStakeholders({
      schoolCode,
      title,
      message,
      eventType: "PANIC_ALERT_TRIGGERED",
      priority,
      metadata: { alertCode, incidentCode, location, triggeredBy: userCode, userRole: role }
    }).catch((err) => logger.warn(`Panic stakeholder notification failed: ${err.message}`));

    // 4. Notify relevant class teacher when identifiable
    const teacherUserCodes = await this._resolvePanicTeacherUserCodes({
      schoolCode,
      triggerUser,
      classCode
    });
    for (const teacherUserCode of teacherUserCodes) {
      await NotificationService.sendDirectNotification({
        schoolCode,
        recipientUserCode: teacherUserCode,
        title,
        message,
        eventType: "PANIC_ALERT_TRIGGERED",
        priority,
        metadata: {
          alertCode,
          incidentCode,
          recipientRole: "CLASS_TEACHER",
          classCode,
          location
        }
      }).catch((err) => logger.warn(`Panic class-teacher notification failed: ${err.message}`));
    }

    // 5. Audit trigger
    await AuditService.log({
      schoolCode,
      actor: {
        userCode,
        role,
        fullName: triggerUser.fullName,
        email: triggerUser.email
      },
      action: "PANIC_ALERT_TRIGGERED",
      resourceType: "PANIC_ALERT",
      resourceId: alertCode,
      reason: remarks || "Emergency SOS button triggered",
      ipAddress,
      userAgent,
      metadata: { incidentCode, location, classCode, busId, confirmationVerified: true }
    });

    return { panicAlert, linkedIncident };
  }

  /**
   * Misuse controls: cooldown + sliding rate limit per tenant/user using Redis (memory fallback).
   * Audits rejected/throttled attempts. Throws 429 when limited.
   */
  static async enforcePanicMisuseControls({ schoolCode, userCode, ipAddress, userAgent }) {
    const cooldownKey = `ssc:panic:cooldown:${schoolCode}:${userCode}`;
    const countKey = `ssc:panic:count:${schoolCode}:${userCode}`;
    const now = Date.now();

    const cooldownRaw = await redisWrapper.get(cooldownKey);
    if (cooldownRaw && now < Number(cooldownRaw)) {
      const retryAfter = Math.ceil((Number(cooldownRaw) - now) / 1000);
      await this._auditPanicAttempt({
        schoolCode,
        userCode,
        ipAddress,
        userAgent,
        action: "PANIC_COOLDOWN_REJECTED",
        reason: `Panic cooldown active. Retry after ${retryAfter} seconds.`,
        metadata: { retryAfterSeconds: retryAfter }
      });
      const err = new Error(`Panic cooldown active. Please retry after ${retryAfter} seconds.`);
      err.statusCode = 429;
      throw err;
    }

    const count = await redisWrapper.incr(countKey, PANIC_RATE_LIMIT_WINDOW_SECONDS);
    if (count > PANIC_MAX_TRIGGERS_PER_WINDOW) {
      await redisWrapper.set(
        cooldownKey,
        String(now + PANIC_COOLDOWN_SECONDS * 1000),
        "EX",
        PANIC_COOLDOWN_SECONDS
      );
      await this._auditPanicAttempt({
        schoolCode,
        userCode,
        ipAddress,
        userAgent,
        action: "PANIC_RATE_LIMITED",
        reason: `Panic rate limit exceeded (max ${PANIC_MAX_TRIGGERS_PER_WINDOW} per ${PANIC_RATE_LIMIT_WINDOW_SECONDS}s). Cooldown applied.`,
        metadata: { count, windowSeconds: PANIC_RATE_LIMIT_WINDOW_SECONDS }
      });
      const err = new Error(
        `Panic rate limit exceeded. Maximum ${PANIC_MAX_TRIGGERS_PER_WINDOW} triggers per ${PANIC_RATE_LIMIT_WINDOW_SECONDS} seconds. Cooldown applied.`
      );
      err.statusCode = 429;
      throw err;
    }

    // Apply cooldown after a successful trigger attempt
    await redisWrapper.set(
      cooldownKey,
      String(now + PANIC_COOLDOWN_SECONDS * 1000),
      "EX",
      PANIC_COOLDOWN_SECONDS
    );
  }

  static async _auditPanicAttempt({ schoolCode, userCode, ipAddress, userAgent, action, reason, metadata = {} }) {
    try {
      await AuditService.log({
        schoolCode,
        actor: { userCode, role: "USER", fullName: userCode, email: undefined },
        action,
        resourceType: "PANIC_ALERT",
        resourceId: null,
        reason,
        ipAddress,
        userAgent,
        metadata
      });
    } catch (err) {
      logger.error(`Panic attempt audit failed: ${err.message}`);
    }
  }

  /**
   * Resolves class-teacher user codes to notify for a panic alert.
   * Sources: explicit classCode in context, or parent's linked children's classes.
   */
  static async _resolvePanicTeacherUserCodes({ schoolCode, triggerUser, classCode }) {
    const teacherCodes = new Set();
    const targetClassCodes = [];

    if (classCode) {
      targetClassCodes.push(classCode);
    }

    if (triggerUser.role === ROLES.PARENT) {
      const links = await ParentStudentLink.find({
        schoolCode,
        parentCode: triggerUser.userCode,
        status: "VERIFIED"
      }).select("studentCode").lean();

      if (links.length) {
        const students = await Student.find({
          schoolCode,
          studentCode: { $in: links.map((l) => l.studentCode) },
          status: "ACTIVE"
        }).select("classCode").lean();

        students.forEach((s) => {
          if (s.classCode) {targetClassCodes.push(s.classCode);}
        });
      }
    }

    for (const classCodeValue of [...new Set(targetClassCodes)]) {
      const assignment = await ClassTeacher.findOne({
        schoolCode,
        classCode: classCodeValue,
        isClassTeacher: true,
        status: "ACTIVE"
      }).select("teacherCode").lean();

      if (assignment) {
        teacherCodes.add(assignment.teacherCode);
      }
    }

    return [...teacherCodes];
  }

  /**
   * Notifies the assigned class teacher of a class.
   */
  static async _notifyClassTeacher({ schoolCode, classCode, title, message, eventType, priority, metadata = {} }) {
    const assignment = await ClassTeacher.findOne({
      schoolCode,
      classCode,
      isClassTeacher: true,
      status: "ACTIVE"
    }).select("teacherCode").lean();

    if (!assignment) {
      return;
    }

    const user = await User.findOne({
      schoolCode,
      userCode: assignment.teacherCode,
      status: "ACTIVE"
    }).select("userCode").lean();

    if (!user) {
      return;
    }

    await NotificationService.sendDirectNotification({
      schoolCode,
      recipientUserCode: user.userCode,
      title,
      message,
      eventType,
      priority,
      metadata: { ...metadata, recipientRole: "CLASS_TEACHER", classCode }
    });
  }

  /* ------------------------------------------------------------------ */
  // Parent scoping helpers
  /* ------------------------------------------------------------------ */

  static async _assertParentLinkedToClass({ schoolCode, parentCode, classCode }) {
    const students = await Student.find({
      schoolCode,
      classCode,
      status: "ACTIVE"
    }).select("studentCode").lean();

    if (!students.length) {
      const err = new Error("No active students found in the specified class.");
      err.statusCode = 400;
      throw err;
    }

    const link = await ParentStudentLink.findOne({
      schoolCode,
      parentCode,
      studentCode: { $in: students.map((s) => s.studentCode) },
      status: "VERIFIED"
    }).lean();

    if (!link) {
      const err = new Error("You are not linked to any active student in this class.");
      err.statusCode = 403;
      throw err;
    }
  }

  static async _assertClassTeacherAssigned({ schoolCode, teacherCode, classCode }) {
    const assignment = await ClassTeacher.findOne({
      schoolCode,
      classCode,
      teacherCode,
      isClassTeacher: true,
      status: "ACTIVE"
    }).lean();

    if (!assignment) {
      const err = new Error("You are not the assigned class teacher for this class.");
      err.statusCode = 403;
      throw err;
    }
  }

  /* ------------------------------------------------------------------ */
  // Panic status updates (School Admin / Transport Coordinator)
  /* ------------------------------------------------------------------ */

  /**
   * Updates a panic alert status with enforced transitions, mandatory remarks,
   * FALSE_ALARM marking, and admin review fields.
   */
  static async updatePanicStatus({
    schoolCode,
    alertCode,
    status,
    remarks,
    updaterUser,
    ipAddress,
    userAgent
  }) {
    if (!remarks || remarks.trim().length < MIN_REMARK_LENGTH) {
      const err = new Error(`Remarks are mandatory when changing panic alert status (minimum ${MIN_REMARK_LENGTH} characters).`);
      err.statusCode = 400;
      throw err;
    }

    const alert = await PanicAlert.findOne({ schoolCode, alertCode });
    if (!alert) {
      const err = new Error(`Panic alert [${alertCode}] not found.`);
      err.statusCode = 404;
      throw err;
    }

    const allowed = PANIC_TRANSITIONS[alert.status] || [];
    if (!allowed.includes(status)) {
      const err = new Error(`Invalid panic alert status transition from [${alert.status}] to [${status}].`);
      err.statusCode = 409;
      throw err;
    }

    const previousStatus = alert.status;
    const trimmedRemarks = remarks.trim();
    const updaterRole = updaterUser.role;
    const updaterUserCode = updaterUser.userCode;

    alert.status = status;
    alert.statusHistory.push({
      status,
      changedBy: updaterUserCode,
      changedAt: new Date(),
      remarks: trimmedRemarks,
      ipAddress,
      userAgent
    });

    if (status === PANIC_ALERT_STATUS.ACKNOWLEDGED) {
      alert.acknowledgedBy = updaterUserCode;
      alert.acknowledgedAt = new Date();
    }

    if (status === PANIC_ALERT_STATUS.RESOLVED || status === PANIC_ALERT_STATUS.FALSE_ALARM) {
      alert.resolvedBy = updaterUserCode;
      alert.resolvedAt = new Date();
    }

    if (status === PANIC_ALERT_STATUS.FALSE_ALARM) {
      alert.falseAlarmMarkedBy = updaterUserCode;
      alert.falseAlarmMarkedAt = new Date();
    }

    // Admin review fields for School Admin / Transport Coordinator
    if (updaterRole === ROLES.SCHOOL_ADMIN || updaterRole === ROLES.TRANSPORT_COORDINATOR) {
      alert.adminReviewBy = updaterUserCode;
      alert.adminReviewAt = new Date();
      alert.adminReviewRemarks = trimmedRemarks;
    }

    await alert.save();

    await AuditService.log({
      schoolCode,
      actor: {
        userCode: updaterUserCode,
        role: updaterRole,
        fullName: updaterUser.fullName,
        email: updaterUser.email
      },
      action: "PANIC_ALERT_STATUS_CHANGED",
      resourceType: "PANIC_ALERT",
      resourceId: alertCode,
      reason: trimmedRemarks,
      ipAddress,
      userAgent,
      metadata: { previousStatus, newStatus: status }
    });

    return alert;
  }

  /* ------------------------------------------------------------------ */
  // Listings with pagination and filters (always tenant-scoped)
  /* ------------------------------------------------------------------ */

  static async listIncidents({ schoolCode, filters = {}, page = 1, limit = 50 }) {
    const query = { schoolCode };

    const allowedFilters = ["status", "type", "severity", "classCode", "busId", "reportedBy"];
    allowedFilters.forEach((key) => {
      if (filters[key] !== undefined && filters[key] !== "") {
        query[key] = filters[key];
      }
    });

    const p = Math.max(parseInt(page, 10), 1);
    const l = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (p - 1) * l;

    const [incidents, total] = await Promise.all([
      Incident.find(query).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Incident.countDocuments(query)
    ]);

    return {
      incidents,
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    };
  }

  static async listPanicAlerts({ schoolCode, filters = {}, page = 1, limit = 50, triggeredBy }) {
    const query = { schoolCode };
    if (triggeredBy) {
      query.triggeredBy = triggeredBy;
    }

    if (filters.status) {
      query.status = filters.status;
    }

    const p = Math.max(parseInt(page, 10), 1);
    const l = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (p - 1) * l;

    const [alerts, total] = await Promise.all([
      PanicAlert.find(query).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      PanicAlert.countDocuments(query)
    ]);

    return {
      alerts,
      total,
      page: p,
      limit: l,
      pages: Math.ceil(total / l)
    };
  }
}

module.exports = IncidentPanicService;
