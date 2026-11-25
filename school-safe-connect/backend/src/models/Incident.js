/**
 * Incident Model
 * Rigorous incident logging with immutable status change trails and device provenance.
 */

const mongoose = require("mongoose");
const { INCIDENT_TYPES, INCIDENT_STATUS } = require("../config/constants");

const incidentSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    incidentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-INC-001
    },
    linkedPanicAlertCode: {
      type: String,
      index: true // Links back to the PanicAlert.alertCode when auto-created from SOS
    },
    source: {
      type: String,
      enum: ["MANUAL_REPORT", "PANIC_AUTO"],
      default: "MANUAL_REPORT"
    },
    type: {
      type: String,
      required: true,
      enum: Object.values(INCIDENT_TYPES),
      index: true
    },
    severity: {
      type: String,
      required: true,
      enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"],
      default: "MEDIUM"
    },
    reportedBy: {
      type: String,
      required: true,
      index: true // userCode
    },
    classCode: {
      type: String,
      index: true
    },
    busId: {
      type: String,
      index: true
    },
    description: {
      type: String,
      required: true
    },
    attachments: [
      {
        fileName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileKey: { type: String },
        fileType: { type: String },
        fileSize: { type: Number }
      }
    ],
    status: {
      type: String,
      required: true,
      enum: Object.values(INCIDENT_STATUS),
      default: INCIDENT_STATUS.OPEN,
      index: true
    },
    statusHistory: [
      {
        status: { type: String, required: true },
        changedBy: { type: String, required: true },
        changedAt: { type: Date, default: Date.now },
        remarks: { type: String, required: true },
        ipAddress: { type: String },
        userAgent: { type: String }
      }
    ],
    resolvedBy: {
      type: String
    },
    resolvedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

incidentSchema.index({ schoolCode: 1, status: 1, createdAt: -1 });

const Incident = mongoose.model("Incident", incidentSchema);

module.exports = Incident;
