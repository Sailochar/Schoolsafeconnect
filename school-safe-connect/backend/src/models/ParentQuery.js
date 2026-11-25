/**
 * ParentQuery Model
 * Persists parent-to-class-teacher queries with daily-limit and bypass metadata.
 */

const mongoose = require("mongoose");

const parentQuerySchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    queryCode: {
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
    studentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    parentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    teacherCode: {
      type: String,
      trim: true,
      uppercase: true,
      index: true
    },
    queryType: {
      type: String,
      enum: ["NORMAL", "SAFETY", "MEDICAL", "BULLYING", "PANIC"],
      default: "NORMAL",
      index: true
    },
    subject: {
      type: String,
      required: true,
      trim: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["OPEN", "ANSWERED", "CLOSED", "ESCALATED"],
      default: "OPEN",
      index: true
    },
    bypassedDailyLimit: {
      type: Boolean,
      default: false
    },
    reply: {
      message: { type: String, trim: true },
      repliedBy: { type: String, trim: true, uppercase: true },
      repliedByRole: { type: String, trim: true, uppercase: true },
      repliedAt: { type: Date }
    }
  },
  {
    timestamps: true
  }
);

parentQuerySchema.index({ schoolCode: 1, classCode: 1, createdAt: -1 });
parentQuerySchema.index({ schoolCode: 1, teacherCode: 1, status: 1, createdAt: -1 });
parentQuerySchema.index({ schoolCode: 1, parentCode: 1, createdAt: -1 });

const ParentQuery = mongoose.model("ParentQuery", parentQuerySchema);

module.exports = ParentQuery;
