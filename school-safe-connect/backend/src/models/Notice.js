/**
 * Notice Model
 * Broadcast messages from School Admins or Teachers to specific target classes and roles.
 */

const mongoose = require("mongoose");
const { NOTIFICATION_PRIORITY } = require("../config/constants");

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

const noticeSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    noticeCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    content: {
      type: String,
      required: true,
      trim: true
    },
    publishedBy: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    publisherName: {
      type: String,
      trim: true
    },
    publisherRole: {
      type: String,
      trim: true,
      uppercase: true
    },
    category: {
      type: String,
      enum: ["EXAM", "ANNOUNCEMENT", "EVENT", "URGENT", "HOLIDAY", "GENERAL"],
      default: "GENERAL",
      index: true
    },
    examDetails: {
      examName: { type: String, trim: true },
      subject: { type: String, trim: true },
      examDate: { type: Date },
      startTime: { type: String, trim: true },
      endTime: { type: String, trim: true },
      syllabus: { type: String, trim: true },
      maxMarks: { type: Number, min: 0 }
    },
    targetRoles: [
      {
        type: String,
        trim: true,
        uppercase: true
      }
    ],
    classCodes: [
      {
        type: String,
        trim: true,
        uppercase: true
      }
    ],
    priority: {
      type: String,
      enum: Object.values(NOTIFICATION_PRIORITY),
      default: NOTIFICATION_PRIORITY.NORMAL,
      index: true
    },
    attachments: [attachmentSchema],
    expiresAt: {
      type: Date,
      index: true
    },
    status: {
      type: String,
      enum: ["PUBLISHED", "ARCHIVED"],
      default: "PUBLISHED",
      index: true
    }
  },
  {
    timestamps: true
  }
);

noticeSchema.index({ schoolCode: 1, status: 1, priority: 1, createdAt: -1 });
noticeSchema.index({ schoolCode: 1, classCodes: 1, createdAt: -1 });

const Notice = mongoose.model("Notice", noticeSchema);

module.exports = Notice;
