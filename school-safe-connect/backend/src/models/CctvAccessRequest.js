/**
 * CctvAccessRequest Model
 * Explicit permission request submitted by a parent, routed to their child's designated Class Teacher.
 */

const mongoose = require("mongoose");

const cctvAccessRequestSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    requestCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true
    },
    parentCode: {
      type: String,
      required: true,
      trim: true,
      index: true // e.g. SSC-SCH-1023-PAR-015
    },
    studentCode: {
      type: String,
      required: true,
      trim: true,
      index: true // e.g. SSC-SCH-1023-STU-102
    },
    classCode: {
      type: String,
      required: true,
      trim: true,
      index: true // e.g. SSC-SCH-1023-CLS-6A
    },
    cameraCode: {
      type: String,
      required: true,
      trim: true,
      index: true // e.g. SSC-SCH-1023-CAM-004
    },
    requestedAt: {
      type: Date,
      default: Date.now
    },
    validForDate: {
      type: String,
      required: true // YYYY-MM-DD
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED", "EXPIRED"],
      default: "PENDING",
      index: true
    },
    reviewedBy: {
      type: String // Class Teacher userCode
    },
    reviewedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    },
    revocationReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

cctvAccessRequestSchema.index({ schoolCode: 1, parentCode: 1, validForDate: 1 });
cctvAccessRequestSchema.index({ schoolCode: 1, classCode: 1, status: 1 });

const CctvAccessRequest = mongoose.model("CctvAccessRequest", cctvAccessRequestSchema);

module.exports = CctvAccessRequest;
