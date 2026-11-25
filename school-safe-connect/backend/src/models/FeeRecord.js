/**
 * FeeRecord Model
 * Tenant-scoped fee record for student tuition, transport, exams, and annual fees.
 */

const mongoose = require("mongoose");

const feeRecordSchema = new mongoose.Schema(
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
    feeType: {
      type: String,
      enum: ["TUITION", "TRANSPORT", "TERM_1", "TERM_2", "ANNUAL", "EXAM", "LIBRARY", "ADMISSION", "OTHER"],
      default: "TUITION"
    },
    amount: {
      type: Number,
      required: true,
      min: 0
    },
    paidAmount: {
      type: Number,
      default: 0,
      min: 0
    },
    status: {
      type: String,
      enum: ["PENDING", "PARTIAL", "PAID"],
      default: "PENDING",
      index: true
    },
    dueDate: {
      type: Date,
      required: true
    },
    paidAt: {
      type: Date
    },
    paymentMethod: {
      type: String,
      enum: ["CASH", "UPI", "CARD", "ONLINE", "NET_BANKING", "CHEQUE", null],
      default: null
    },
    receiptNumber: {
      type: String,
      trim: true
    },
    transactionRef: {
      type: String,
      trim: true
    },
    parentName: {
      type: String,
      trim: true
    },
    parentPhone: {
      type: String,
      trim: true
    },
    parentEmail: {
      type: String,
      trim: true
    },
    whatsappRemindersSent: {
      type: Number,
      default: 0
    },
    lastReminderAt: {
      type: Date
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

feeRecordSchema.index({ schoolCode: 1, status: 1 });
feeRecordSchema.index({ schoolCode: 1, classCode: 1 });
feeRecordSchema.index({ schoolCode: 1, studentCode: 1 });

const FeeRecord = mongoose.model("FeeRecord", feeRecordSchema);

module.exports = FeeRecord;
