/**
 * CctvSession Model
 * Live streaming session audit record with device binding, watermark identification, and termination metrics.
 */

const mongoose = require("mongoose");
const { CCTV_END_REASONS } = require("../config/constants");

const cctvSessionSchema = new mongoose.Schema(
  {
    sessionId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
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
      index: true
    },
    cameraId: {
      type: String,
      required: true,
      trim: true,
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
      trim: true
    },
    streamTokenHash: {
      type: String,
      required: true,
      select: false
    },
    startedAt: {
      type: Date,
      default: Date.now
    },
    scheduledEndAt: {
      type: Date,
      required: true
    },
    actualEndAt: {
      type: Date
    },
    endReason: {
      type: String,
      enum: Object.values(CCTV_END_REASONS)
    },
    watermarkId: {
      type: String,
      required: true
    },
    ipAddress: {
      type: String,
      required: true
    },
    deviceModel: {
      type: String
    },
    appVersion: {
      type: String
    },
    osVersion: {
      type: String
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    }
  },
  {
    timestamps: true
  }
);

cctvSessionSchema.index({ schoolCode: 1, parentCode: 1, isActive: 1 });
cctvSessionSchema.index({ schoolCode: 1, cameraId: 1, isActive: 1 });

const CctvSession = mongoose.model("CctvSession", cctvSessionSchema);

module.exports = CctvSession;
