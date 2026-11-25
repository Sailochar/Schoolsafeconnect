/**
 * TransportAccessRequest Model
 * Parent application for bus tracking authorization.
 */

const mongoose = require("mongoose");

const transportAccessRequestSchema = new mongoose.Schema(
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
      index: true
    },
    studentCode: {
      type: String,
      required: true,
      trim: true,
      index: true
    },
    routeCode: {
      type: String,
      required: true,
      index: true
    },
    busCode: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["PENDING", "APPROVED", "REJECTED", "REVOKED"],
      default: "PENDING",
      index: true
    },
    reviewedBy: {
      type: String // Transport Coordinator or School Admin userCode
    },
    reviewedAt: {
      type: Date
    },
    remarks: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

transportAccessRequestSchema.index({ schoolCode: 1, parentCode: 1, status: 1 });

const TransportAccessRequest = mongoose.model("TransportAccessRequest", transportAccessRequestSchema);

module.exports = TransportAccessRequest;
