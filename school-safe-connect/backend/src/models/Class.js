/**
 * Class Model
 * Tenant-scoped academic class and section.
 * Configures class-wise CCTV timings and access parameters.
 */

const mongoose = require("mongoose");

const classSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    classCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-CLS-6A
    },
    grade: {
      type: String,
      required: true,
      trim: true // e.g. "6"
    },
    section: {
      type: String,
      required: true,
      trim: true // e.g. "A"
    },
    academicYear: {
      type: String,
      required: true,
      index: true // e.g. "2026-2027"
    },
    roomNumber: {
      type: String,
      trim: true
    },
    capacity: {
      type: Number,
      default: 40
    },
    // Class-wise CCTV Timing & Session Rules (Configurable per class by School Admin)
    cctvAccess: {
      enabled: { type: Boolean, default: false },
      days: {
        type: [String],
        enum: ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"],
        default: ["MON", "TUE", "WED", "THU", "FRI"]
      },
      startTime: { type: String, default: "09:00" }, // HH:mm format
      endTime: { type: String, default: "16:00" }, // HH:mm format
      timezone: { type: String, default: "Asia/Kolkata" },
      maxSessionMinutes: { type: Number, default: 10, min: 1, max: 30 },
      maxSessionsPerDay: { type: Number, default: 5, min: 1, max: 20 },
      cooldownMinutes: { type: Number, default: 15, min: 0, max: 60 },
      allowedCameraIds: [{ type: String }],
      requiresTeacherApproval: { type: Boolean, default: true },
      accessExpiry: { type: Date }
    },
    status: {
      type: String,
      enum: ["ACTIVE", "ARCHIVED"],
      default: "ACTIVE",
      index: true
    }
  },
  {
    timestamps: true
  }
);

classSchema.index({ schoolCode: 1, grade: 1, section: 1, academicYear: 1 }, { unique: true });
classSchema.index({ schoolCode: 1, status: 1 });

const Class = mongoose.model("Class", classSchema);

module.exports = Class;
