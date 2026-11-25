/**
 * Timetable Model
 * School Admin-generated class-wise weekly timetable governing teacher schedules,
 * parent classroom views, and strict timetable-scoped CCTV preview windows
 * (12 min at session start/end, 1 min mid-class).
 */

const mongoose = require("mongoose");

const timetableSessionSchema = new mongoose.Schema(
  {
    sessionId: { type: String, required: true, trim: true },
    periodNumber: { type: Number, required: true, min: 1 },
    title: { type: String, required: true, trim: true },
    subject: { type: String, required: true, trim: true },
    teacherCode: { type: String, trim: true, uppercase: true },
    teacherName: { type: String, trim: true },
    startTime: { type: String, required: true, trim: true }, // "HH:MM" (24h)
    endTime: { type: String, required: true, trim: true },   // "HH:MM" (24h)
    isBreak: { type: Boolean, default: false }
  },
  { _id: false }
);

const timetableSchema = new mongoose.Schema(
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
      trim: true,
      uppercase: true,
      index: true
    },
    academicYear: {
      type: String,
      default: "2026-2027",
      trim: true
    },
    dayOfWeek: {
      type: String,
      enum: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
      required: true,
      index: true
    },
    sessions: [timetableSessionSchema],
    cctvPolicy: {
      boundaryWindowMinutes: { type: Number, default: 12, min: 1, max: 30 }, // 12 mins at start or end
      midSessionPreviewSeconds: { type: Number, default: 60, min: 15, max: 300 }, // 1 min in between
      enforceTimetable: { type: Boolean, default: true }
    },
    updatedBy: {
      type: String,
      trim: true,
      uppercase: true
    }
  },
  {
    timestamps: true
  }
);

timetableSchema.index({ schoolCode: 1, classCode: 1, dayOfWeek: 1 }, { unique: true });

const Timetable = mongoose.model("Timetable", timetableSchema);

module.exports = Timetable;
