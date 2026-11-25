/**
 * Assignment Model
 * Tenant-scoped and class-scoped academic tasks created by teachers.
 */

const mongoose = require("mongoose");

const attachmentSchema = new mongoose.Schema(
  {
    fileName: { type: String, required: true, trim: true },
    fileUrl: { type: String, required: true, trim: true },
    fileKey: { type: String, trim: true },
    fileType: { type: String, trim: true },
    fileSize: { type: Number, min: 0 }
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
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
      unique: true,
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
    teacherCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    teacherName: {
      type: String,
      trim: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    format: {
      type: String,
      enum: ["PDF", "DOC", "TEXT", "MIXED"],
      default: "TEXT"
    },
    assignmentType: {
      type: String,
      enum: ["HOMEWORK", "PROJECT", "EXAM_PREP", "WORKSHEET"],
      default: "HOMEWORK"
    },
    attachments: [attachmentSchema],
    dueDate: {
      type: Date,
      required: true,
      index: true
    },
    expiresAt: {
      type: Date,
      default: () => new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    },
    maxScore: {
      type: Number,
      default: 100,
      min: 0
    },
    status: {
      type: String,
      enum: ["DRAFT", "PUBLISHED", "ARCHIVED"],
      default: "PUBLISHED",
      index: true
    }
  },
  {
    timestamps: true
  }
);

assignmentSchema.index({ schoolCode: 1, classCode: 1, status: 1, dueDate: -1 });
assignmentSchema.index({ schoolCode: 1, teacherCode: 1, createdAt: -1 });
// Automatic 1-week (7-day) TTL expiry and deletion
assignmentSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const Assignment = mongoose.model("Assignment", assignmentSchema);

module.exports = Assignment;
