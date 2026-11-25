/**
 * PanicAlert Model
 * Critical SOS alerts with automated incident creation and multi-channel dissemination.
 */

const mongoose = require("mongoose");
const { PANIC_ALERT_STATUS } = require("../config/constants");

const panicAlertSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    alertCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-PAN-001
    },
    triggeredBy: {
      type: String,
      required: true,
      index: true // userCode
    },
    userRole: {
      type: String,
      required: true
    },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      addressText: { type: String }
    },
    incidentId: {
      type: String,
      index: true // Linked incidentCode
    },
    priority: {
      type: String,
      default: "CRITICAL",
      enum: ["CRITICAL"]
    },
    status: {
      type: String,
      enum: Object.values(PANIC_ALERT_STATUS),
      default: PANIC_ALERT_STATUS.TRIGGERED,
      index: true
    },
    channelsNotified: [
      {
        type: String,
        enum: ["IN_APP", "PUSH", "WHATSAPP", "SMS"]
      }
    ],
    confirmationVerified: {
      type: Boolean,
      default: false
    },
    triggerCount: {
      type: Number,
      default: 0
    },
    cooldownUntil: {
      type: Date
    },
    acknowledgedBy: {
      type: String
    },
    acknowledgedAt: {
      type: Date
    },
    resolvedBy: {
      type: String
    },
    resolvedAt: {
      type: Date
    },
    falseAlarmMarkedBy: {
      type: String
    },
    falseAlarmMarkedAt: {
      type: Date
    },
    adminReviewBy: {
      type: String
    },
    adminReviewAt: {
      type: Date
    },
    adminReviewRemarks: {
      type: String
    },
    remarks: {
      type: String
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        remarks: { type: String, required: true },
        ipAddress: { type: String },
        userAgent: { type: String }
      }
    ]
  },
  {
    timestamps: true
  }
);

panicAlertSchema.index({ schoolCode: 1, status: 1, createdAt: -1 });

const PanicAlert = mongoose.model("PanicAlert", panicAlertSchema);

module.exports = PanicAlert;
