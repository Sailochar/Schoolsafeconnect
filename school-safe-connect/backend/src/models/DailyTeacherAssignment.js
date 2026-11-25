/**
 * DailyTeacherAssignment Model
 * Records day-wise and period-wise assignment of teachers to classes.
 * Allows teachers to teach multiple classes and parents to receive updates from multiple teachers.
 */

const mongoose = require("mongoose");

const dailyTeacherAssignmentSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
      index: true
    },
    classCode: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    section: {
      type: String,
      trim: true
    },
    periodNumber: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
      default: 1
    },
    startTime: {
      type: String,
      default: "09:00"
    },
    endTime: {
      type: String,
      default: "09:45"
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    teacherCode: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    teacherName: {
      type: String,
      required: true,
      trim: true
    },
    isClassTeacher: {
      type: Boolean,
      default: false
    },
    assignedBy: {
      type: String,
      trim: true
    },
    notes: {
      type: String,
      trim: true
    }
  },
  {
    timestamps: true
  }
);

dailyTeacherAssignmentSchema.index({ schoolCode: 1, date: 1, classCode: 1, periodNumber: 1 }, { unique: true });
dailyTeacherAssignmentSchema.index({ schoolCode: 1, date: 1, teacherCode: 1 });

const DailyTeacherAssignment = mongoose.model("DailyTeacherAssignment", dailyTeacherAssignmentSchema);

module.exports = DailyTeacherAssignment;
