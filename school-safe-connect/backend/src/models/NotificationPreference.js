/**
 * NotificationPreference Model
 * User-specific communication channels and quiet hour settings.
 */

const mongoose = require("mongoose");

const notificationPreferenceSchema = new mongoose.Schema(
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
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    emailEnabled: {
      type: Boolean,
      default: true
    },
    smsEnabled: {
      type: Boolean,
      default: true
    },
    pushEnabled: {
      type: Boolean,
      default: true
    },
    whatsappEnabled: {
      type: Boolean,
      default: true
    },
    quietHours: {
      enabled: { type: Boolean, default: false },
      startTime: { type: String, default: "22:00" }, // HH:mm
      endTime: { type: String, default: "06:00" } // HH:mm
    }
  },
  {
    timestamps: true
  }
);

notificationPreferenceSchema.index({ schoolCode: 1, userCode: 1 });

const NotificationPreference = mongoose.model("NotificationPreference", notificationPreferenceSchema);

module.exports = NotificationPreference;
