/**
 * AssignmentSubmission Model
 * Tracks parent viewing confirmations and (future) student submissions per assignment/student.
 */

const mongoose = require("mongoose");

const fileSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    fileKey: { type: String, trim: true },
    fileType: { type: String, trim: true },
    fileSize: { type: Number, min: 0 }
  },
  { _id: false }
);

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    assignmentCode: {
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
    parentCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    submissionFiles: [fileSchema],
    submittedAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ["NOT_SUBMITTED", "SUBMITTED", "REVIEWED", "GRADED"],
      default: "NOT_SUBMITTED",
      index: true
    },
    score: {
      type: Number,
      min: 0
    },
    feedback: {
      type: String,
      trim: true
    },
    viewedByParentAt: {
      type: Date,
      index: true
    }
  },
  {
    timestamps: true
  }
);

assignmentSubmissionSchema.index({ schoolCode: 1, assignmentCode: 1, studentCode: 1 }, { unique: true });
assignmentSubmissionSchema.index({ schoolCode: 1, studentCode: 1, createdAt: -1 });

const AssignmentSubmission = mongoose.model("AssignmentSubmission", assignmentSubmissionSchema);

module.exports = AssignmentSubmission;
