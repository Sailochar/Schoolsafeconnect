/**
 * Notification Model
 * Multi-channel dispatched alert records with delivery telemetry, retry tracking,
 * and tenant-scoped delivery status lifecycle.
 */

const mongoose = require("mongoose");
const { NOTIFICATION_PRIORITY, NOTIFICATION_CHANNEL_STATUS, NOTIFICATION_STATUS } = require("../config/constants");

const notificationSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    notificationId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true
    },
    recipientUserCode: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true
    },
    eventType: {
      type: String,
      required: true,
      index: true
    },
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITY),
      default: NOTIFICATION_PRIORITY.NORMAL
    },
    channelsDispatched: [
      {
        channel: { type: String, enum: ["IN_APP", "PUSH", "WHATSAPP", "SMS"], required: true },
        status: { type: String, enum: Object.values(NOTIFICATION_CHANNEL_STATUS), default: NOTIFICATION_CHANNEL_STATUS.PENDING },
        attempts: { type: Number, default: 0 },
        lastAttemptAt: { type: Date },
        sentAt: { type: Date },
        deliveredAt: { type: Date },
        failedAt: { type: Date },
        error: { type: String },
        providerMessageId: { type: String, trim: true }
      }
    ],
    status: {
      type: String,
      enum: Object.values(NOTIFICATION_STATUS),
      default: NOTIFICATION_STATUS.PENDING,
      index: true
    },
    retryCount: {
      type: Number,
      default: 0
    },
    maxRetries: {
      type: Number,
      default: function () {
        return 3;
      }
    },
    nextRetryAt: { type: Date },
    lastError: { type: String },
    idempotencyKey: { type: String, sparse: true, index: true },
    expiresAt: { type: Date },
    deliveredAt: { type: Date },
    readAt: { type: Date },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: true
  }
);

// Tenant-scoped query indexes
notificationSchema.index({ schoolCode: 1, recipientUserCode: 1, status: 1, createdAt: -1 });
notificationSchema.index({ schoolCode: 1, recipientUserCode: 1, createdAt: -1 });
notificationSchema.index({ eventType: 1, createdAt: -1 });

const Notification = mongoose.model("Notification", notificationSchema);

module.exports = Notification;
