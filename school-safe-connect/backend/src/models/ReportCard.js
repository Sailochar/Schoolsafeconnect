/**
 * ReportCard Model
 * Cumulative academic record for students across all FA & SA and custom evaluations.
 */

const mongoose = require("mongoose");

const reportCardSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    studentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    admissionNumber: {
      type: String,
      required: true,
      trim: true
    },
    studentName: {
      type: String,
      required: true,
      trim: true
    },
    classCode: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    academicYear: {
      type: String,
      required: true,
      default: "2026-2027",
      trim: true,
      index: true
    },
    assessments: [
      {
        assessmentId: { type: mongoose.Schema.Types.ObjectId, ref: "Assessment" },
        assessmentType: { type: String, required: true }, // FA-1, FA-2, SA-1, etc.
        title: { type: String, required: true },
        subject: { type: String, required: true },
        totalQuestions: { type: Number, default: 0 },
        attempted: { type: Number, default: 0 },
        correct: { type: Number, default: 0 },
        wrong: { type: Number, default: 0 },
        maxMarks: { type: Number, required: true },
        marksObtained: { type: Number, required: true },
        percentage: { type: Number, required: true },
        grade: { type: String, required: true },
        rank: { type: Number },
        evaluatedAt: { type: Date, default: Date.now },
        remarks: { type: String, default: "" }
      }
    ],
    overallStats: {
      totalAssessments: { type: Number, default: 0 },
      totalMaxMarks: { type: Number, default: 0 },
      totalMarksObtained: { type: Number, default: 0 },
      overallPercentage: { type: Number, default: 0 },
      overallGrade: { type: String, default: "N/A" }
    },
    teacherRemarks: {
      type: String,
      default: "Consistent academic progress demonstrated throughout assessments."
    },
    lastUpdated: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true
  }
);

reportCardSchema.index({ schoolCode: 1, studentCode: 1, academicYear: 1 }, { unique: true });
reportCardSchema.index({ schoolCode: 1, classCode: 1 });

const ReportCard = mongoose.model("ReportCard", reportCardSchema);

module.exports = ReportCard;
