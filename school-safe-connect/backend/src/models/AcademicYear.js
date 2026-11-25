/**
 * AcademicYear Model
 * Tracks annual academic cycles and rollover archival states.
 */

const mongoose = require("mongoose");

const academicYearSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    academicYearCode: {
      type: String,
      required: true,
      trim: true // e.g. "2026-2027"
    },
    yearName: {
      type: String,
      required: true,
      trim: true // e.g. "Academic Session 2026-2027"
    },
    startDate: {
      type: Date,
      required: true
    },
    endDate: {
      type: Date,
      required: true
    },
    isCurrent: {
      type: Boolean,
      default: true
    },
    isArchived: {
      type: Boolean,
      default: false,
      index: true
    },
    archivedAt: {
      type: Date
    },
    archivedBy: {
      type: String // userCode of Super Admin
    },
    rolloverReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

academicYearSchema.index({ schoolCode: 1, academicYearCode: 1 }, { unique: true });
academicYearSchema.index({ schoolCode: 1, isCurrent: 1 });

const AcademicYear = mongoose.model("AcademicYear", academicYearSchema);

module.exports = AcademicYear;
