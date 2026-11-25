/**
 * Device Model
 * Device fingerprinting, trusted bindings, and Firebase Cloud Messaging push tokens.
 * Supports active-device lookup per user + tenant for FCM push delivery.
 */

const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    userCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    deviceId: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    fcmToken: {
      type: String,
      trim: true
    },
    deviceModel: {
      type: String,
      trim: true
    },
    osVersion: {
      type: String,
      trim: true
    },
    appVersion: {
      type: String,
      trim: true
    },
    platform: {
      type: String,
      trim: true
    },
    isTrusted: {
      type: Boolean,
      default: true
    },
    isActive: {
      type: Boolean,
      default: true
    },
    lastActiveAt: {
      type: Date,
      default: Date.now
    },
    lastSeenAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

deviceSchema.index({ schoolCode: 1, userCode: 1, deviceId: 1 }, { unique: true });
deviceSchema.index({ schoolCode: 1, userCode: 1, isActive: 1 });
deviceSchema.index({ fcmToken: 1 });

const Device = mongoose.model("Device", deviceSchema);

module.exports = Device;
