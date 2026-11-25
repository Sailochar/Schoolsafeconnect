/**
 * Notification Queue Service
 * Redis-backed (ioredis) reliable queue for per-notification/per-channel delivery jobs,
 * with exponential backoff retries, per-job locking, dead-letter queue, and an in-memory
 * fallback when Redis is unavailable. No Bull / extra dependencies.
 *
 * Job payload: { jobId, notificationId, channel, attempt, enqueuedAt }
 * Source of truth remains the Notification document (channelsDispatched[*].status/attempts/error).
 */

const Redis = require("ioredis");
const { Notification } = require("../models");
const NotificationSenderService = require("./notificationSender.service");
const AuditService = require("./audit.service");
const config = require("../config/env");
const logger = require("../utils/logger");

const QUEUE_KEY = "notif:queue";
const SCHEDULED_KEY = "notif:scheduled";
const DLQ_KEY = "notif:dlq";
const LOCK_TTL_MS = 5 * 60 * 1000; // 5 minutes per notification+channel claim

let redisClient = null;
let redisReady = false;

try {
  redisClient = new Redis(config.REDIS.URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: true,
    retryStrategy: (times) => Math.min(times * 50, 2000)
  });
  redisClient.on("connect", () => {
    redisReady = true;
    logger.info("[NotificationQueue] Redis connection established.");
  });
  redisClient.on("error", () => {
    redisReady = false;
  });
  redisClient.on("close", () => {
    redisReady = false;
  });
} catch (error) {
  logger.warn("[NotificationQueue] Redis init failed; using in-memory fallback.", error.message);
}

// In-memory fallback when Redis is offline.
const memoryQueue = [];
const memoryScheduled = []; // { runAt, payload }
const memoryDlq = [];

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function lockKey(notificationId, channel) {
  return `notif:lock:${notificationId}:${channel}`;
}

const NotificationQueueService = {
  running: false,
  _stopRequested: false,

  /**
   * Enqueue a delivery job. Returns the job id.
   */
  async enqueueJob({ notificationId, channel, attempt = 0 }) {
    const jobId = `job-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const payload = { jobId, notificationId, channel, attempt, enqueuedAt: Date.now() };

    try {
      if (redisClient && redisReady) {
        await redisClient.rpush(QUEUE_KEY, JSON.stringify(payload));
        return jobId;
      }
    } catch (error) {
      logger.warn(`[NotificationQueue] enqueueJob redis error: ${error.message}. Falling back to memory.`);
      redisReady = false;
    }

    memoryQueue.push(payload);
    return jobId;
  },

  /**
   * Convenience: enqueue a newly created notification's outbound channels.
   */
  async enqueueNotification(notificationId, { channels = [], attempt = 0 } = {}) {
    const jobs = [];
    for (const channel of channels) {
      jobs.push(this.enqueueJob({ notificationId, channel, attempt }));
    }
    await Promise.all(jobs);
    return jobs.length;
  },

  /**
   * Attempt to acquire a short-lived lock for a notification+channel to prevent
   * duplicate in-flight processing across worker instances.
   */
  async acquireLock(notificationId, channel) {
    const key = lockKey(notificationId, channel);
    try {
      if (redisClient && redisReady) {
        const result = await redisClient.set(key, "1", "NX", "PX", LOCK_TTL_MS);
        return result === "OK";
      }
    } catch (error) {
      redisReady = false;
    }
    // Memory fallback: optimistic (no real distributed lock), good enough for single-process dev.
    return true;
  },

  async releaseLock(notificationId, channel) {
    const key = lockKey(notificationId, channel);
    try {
      if (redisClient && redisReady) {
        await redisClient.del(key);
        return;
      }
    } catch (error) {
      redisReady = false;
    }
  },

  /**
   * Process a single job: send the channel, update the Notification doc,
   * re-enqueue with exponential backoff on retryable failure, or mark terminal.
   */
  async processJob(job) {
    const { notificationId, channel, attempt } = job;
    const now = Date.now();

    let notification;
    try {
      notification = await Notification.findById(notificationId);
      if (!notification) {
        logger.warn(`[NotificationQueue] Notification ${notificationId} not found; skipping job ${job.jobId}`);
        return { skipped: true, reason: "notification_not_found" };
      }

      // Tenant scope is implicit via the notification document (schoolCode set at creation).
      const channelEntryIndex = notification.channelsDispatched.findIndex(
        (c) => c.channel === channel
      );
      if (channelEntryIndex === -1) {
        logger.warn(`[NotificationQueue] Channel ${channel} not present on notification ${notificationId}`);
        return { skipped: true, reason: "channel_absent" };
      }

      // Already terminal? skip (idempotent).
      const entry = notification.channelsDispatched[channelEntryIndex];
      if (entry.status === "SENT" || entry.status === "DELIVERED" || entry.status === "SKIPPED") {
        return { skipped: true, reason: "channel_terminal" };
      }

      // Mark attempt + queued/in-progress.
      entry.attempts = (entry.attempts || 0) + 1;
      entry.lastAttemptAt = new Date();
      entry.status = "QUEUED";
      await notification.save();

      let result;
      try {
        switch (channel) {
        case "PUSH": {
          const tokens = await this._getFcmTokens(notification.schoolCode, notification.recipientUserCode);
          result = await NotificationSenderService.sendPush({
            schoolCode: notification.schoolCode,
            tokens,
            title: notification.title,
            message: notification.message,
            data: { ...(notification.metadata || {}), notificationId: notification.notificationId }
          });
          if (result.invalidTokens && result.invalidTokens.length) {
            await this._deactivateTokens(notification.schoolCode, notification.recipientUserCode, result.invalidTokens);
          }
          break;
        }
        case "SMS": {
          const recipient = await this._getRecipient(notification);
          result = await NotificationSenderService.sendSms({
            phone: recipient && recipient.phone ? recipient.phone : "",
            message: notification.message
          });
          break;
        }
        case "WHATSAPP": {
          const recipient = await this._getRecipient(notification);
          result = await NotificationSenderService.sendWhatsApp({
            phone: recipient && recipient.phone ? recipient.phone : "",
            message: notification.message
          });
          break;
        }
        default:
          throw new Error(`Unsupported channel: ${channel}`);
        }
      } catch (sendError) {
        result = { success: false, error: sendError.message };
      }

      const success = result && result.success !== false && !(result.failures && result.failures.length > 0 && result.successes.length !== 0);

      if (success) {
        entry.status = "SENT";
        entry.sentAt = new Date();
        entry.providerMessageId = result.successes && result.successes[0] ? result.successes[0].messageId : result.messageId || null;
        entry.error = undefined;
        await notification.save();
        await this._recomputeStatus(notification);
        logger.info(`[NotificationQueue] ${channel} SENT for notification ${notification.notificationId}`);
        return { sent: true, channel, result };
      }

      // Failure path.
      const errorMessage = (result && result.error) || "channel_send_failed";
      entry.status = "FAILED";
      entry.error = errorMessage;
      entry.failedAt = new Date();
      await notification.save();

      const maxRetries = (notification.maxRetries !== null && notification.maxRetries !== undefined) ? notification.maxRetries : 3;
      if (attempt < maxRetries) {
        // Exponential backoff: base * 2^attempt, capped.
        const baseDelay = config.NOTIFICATION.RETRY_BASE_DELAY_MS || 1000;
        const maxDelay = config.NOTIFICATION.RETRY_MAX_DELAY_MS || 60000;
        const delayMs = Math.min(baseDelay * Math.pow(2, attempt), maxDelay);
        const nextRetryAt = new Date(now + delayMs);
        notification.retryCount = (notification.retryCount || 0) + 1;
        notification.nextRetryAt = nextRetryAt;
        notification.lastError = errorMessage;
        await notification.save();

        await this.enqueueJob({ notificationId, channel, attempt: attempt + 1 });
        // Also record in scheduled set so it retries after delay.
        await this._addScheduled(nextRetryAt, { notificationId, channel, attempt: attempt + 1 });
        logger.warn(`[NotificationQueue] ${channel} FAILED (attempt ${attempt + 1}/${maxRetries}) for ${notification.notificationId}; retry in ${delayMs}ms`);
        return { retried: true, channel, attempt: attempt + 1, error: errorMessage };
      }

      // Terminal failure.
      entry.status = "FAILED";
      entry.failedAt = new Date();
      notification.lastError = errorMessage;
      await notification.save();
      await this._recomputeStatus(notification);
      await this._pushDlq({ notificationId: notification._id, notificationIdStr: notification.notificationId, channel, error: errorMessage, failedAt: new Date() });

      await AuditService.log({
        schoolCode: notification.schoolCode,
        actor: { userCode: "SYSTEM", role: "SYSTEM", fullName: "Notification Worker", email: "system@schoolsafeconnect.internal" },
        action: "NOTIFICATION_CHANNEL_DEAD_LETTER",
        resourceType: "NOTIFICATION",
        resourceId: notification.notificationId,
        reason: `Channel ${channel} delivery exhausted retries`,
        ipAddress: "127.0.0.1",
        userAgent: "notification-worker",
        metadata: { recipientUserCode: notification.recipientUserCode, channel, error: errorMessage, attempts: entry.attempts }
      }).catch((err) => logger.error("[NotificationQueue] Dead-letter audit write failed:", err.message));

      logger.error(`[NotificationQueue] ${channel} DEAD-LETTER for notification ${notification.notificationId}: ${errorMessage}`);
      return { deadLetter: true, channel, error: errorMessage };
    } catch (error) {
      logger.error(`[NotificationQueue] processJob error for ${notificationId}:`, error);
      return { error: error.message };
    } finally {
      await this.releaseLock(notificationId, channel);
    }
  },

  async _getRecipient(notification) {
    const { User } = require("../models");
    return User.findOne({
      schoolCode: notification.schoolCode,
      userCode: notification.recipientUserCode,
      status: "ACTIVE"
    }).lean();
  },

  async _getFcmTokens(schoolCode, userCode) {
    const { Device } = require("../models");
    const devices = await Device.find({
      schoolCode,
      userCode,
      isActive: true,
      fcmToken: { $exists: true, $ne: "" }
    }).select("fcmToken").lean();
    return devices.map((d) => d.fcmToken).filter(Boolean);
  },

  async _deactivateTokens(schoolCode, userCode, tokens) {
    const { Device } = require("../models");
    try {
      await Device.updateMany(
        { schoolCode, userCode, fcmToken: { $in: tokens } },
        { $set: { isActive: false, lastSeenAt: new Date() } }
      );
    } catch (error) {
      logger.warn("[NotificationQueue] token deactivation update failed:", error.message);
    }
  },

  async _recomputeStatus(notification) {
    const entries = notification.channelsDispatched || [];
    if (entries.length === 0) {return;}

    const allSentOrDelivered = entries.every((e) => e.status === "SENT" || e.status === "DELIVERED");
    const allDelivered = entries.every((e) => e.status === "DELIVERED");
    const allSkipped = entries.every((e) => e.status === "SKIPPED");
    const anyFailed = entries.some((e) => e.status === "FAILED");
    const anyPending = entries.some((e) => e.status === "PENDING" || e.status === "QUEUED");

    let status;
    if (allSkipped) {
      status = "SENT";
    } else if (allDelivered) {
      status = "DELIVERED";
      notification.deliveredAt = new Date();
    } else if (allSentOrDelivered) {
      status = "SENT";
    } else if (anyFailed && !anyPending) {
      status = "FAILED";
    } else if (anyFailed) {
      status = "PARTIAL";
    } else {
      status = "QUEUED";
    }

    notification.status = status;
    await notification.save();
  },

  async _addScheduled(runAt, payload) {
    try {
      if (redisClient && redisReady) {
        await redisClient.zadd(SCHEDULED_KEY, runAt.getTime ? runAt.getTime() : runAt, JSON.stringify(payload));
        return;
      }
    } catch (error) {
      redisReady = false;
    }
    memoryScheduled.push({ runAt: runAt.getTime ? runAt.getTime() : runAt, payload });
  },

  async _pushDlq(record) {
    try {
      if (redisClient && redisReady) {
        await redisClient.rpush(DLQ_KEY, JSON.stringify(record));
        return;
      }
    } catch (error) {
      redisReady = false;
    }
    memoryDlq.push(record);
  },

  /**
   * Move due scheduled jobs into the main queue.
   */
  async _drainScheduled() {
    try {
      if (redisClient && redisReady) {
        const now = Date.now();
        const jobs = await redisClient.zrangebyscore(SCHEDULED_KEY, 0, now);
        if (jobs.length) {
          await redisClient.zrem(SCHEDULED_KEY, ...jobs);
          for (const raw of jobs) {
            await redisClient.rpush(QUEUE_KEY, raw);
          }
        }
        return;
      }
    } catch (error) {
      redisReady = false;
    }
    // Memory fallback.
    const now = Date.now();
    const due = memoryScheduled.filter((j) => j.runAt <= now);
    memoryScheduled.splice(0, memoryScheduled.length, ...memoryScheduled.filter((j) => j.runAt > now));
    for (const j of due) {
      memoryQueue.push(j.payload);
    }
  },

  async _popJob() {
    try {
      if (redisClient && redisReady) {
        const result = await redisClient.blpop(QUEUE_KEY, 1); // 1 second block
        if (result) {
          const [, raw] = result;
          return JSON.parse(raw);
        }
        return null;
      }
    } catch (error) {
      redisReady = false;
    }
    // Memory fallback: poll.
    if (memoryQueue.length) {
      return memoryQueue.shift();
    }
    return null;
  },

  /**
   * Start the worker loop. Safe to call multiple times; no-op if already running.
   */
  async start() {
    if (this.running) {return;}
    this.running = true;
    this._stopRequested = false;
    logger.info("[NotificationQueue] Worker started.");

    while (!this._stopRequested) {
      try {
        await this._drainScheduled();
        const job = await this._popJob();
        if (job) {
          const locked = await this.acquireLock(job.notificationId, job.channel);
          if (locked) {
            await this.processJob(job);
          } else {
            // Another worker is processing; re-enqueue to retry shortly.
            await this.enqueueJob({ notificationId: job.notificationId, channel: job.channel, attempt: job.attempt || 0 });
          }
        }
      } catch (error) {
        logger.error("[NotificationQueue] Worker loop error:", error.message);
        await delay(1000);
      }
      if (!redisClient || !redisReady) {
        await delay(500); // memory fallback poll interval
      }
    }

    this.running = false;
    logger.info("[NotificationQueue] Worker stopped.");
  },

  /**
   * Stop the worker loop gracefully.
   */
  stop() {
    this._stopRequested = true;
  },

  /**
   * Process all currently queued jobs once (useful in tests / on-demand).
   * Resolves when the queue is drained.
   */
  async processPending() {
    await this._drainScheduled();
    let drained = false;
    while (!drained) {
      const job = await this._popJob();
      if (!job) {
        drained = true;
        break;
      }
      const locked = await this.acquireLock(job.notificationId, job.channel);
      if (locked) {
        await this.processJob(job);
      } else {
        await this.enqueueJob(job);
      }
    }
  },

  async disconnect() {
    this.stop();
    try {
      if (redisClient) {
        await redisClient.quit();
      }
    } catch (error) {
      // ignore
    }
  }
};

module.exports = NotificationQueueService;
