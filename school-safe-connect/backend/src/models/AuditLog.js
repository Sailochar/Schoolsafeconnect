/**
 * AuditLog Model
 * Append-only, cryptographically verifiable, strictly immutable audit ledger.
 * Mutation or deletion is blocked at the schema level.
 */

const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    logId: {
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
      index: true // "GLOBAL" for super admin platform actions, or "SSC-SCH-XXXX"
    },
    actor: {
      userCode: { type: String, required: true },
      role: { type: String, required: true },
      fullName: { type: String },
      email: { type: String }
    },
    action: {
      type: String,
      required: true,
      index: true
    },
    resourceType: {
      type: String,
      required: true
    },
    resourceId: {
      type: String
    },
    reason: {
      type: String // Mandatory for Super Admin cross-tenant lookups and high-risk workflows
    },
    ipAddress: {
      type: String,
      required: true
    },
    userAgent: {
      type: String
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed
    }
  },
  {
    timestamps: { createdAt: true, updatedAt: false } // Immutable: no updatedAt
  }
);

// Indexes for high-speed compliance and audit investigations
auditLogSchema.index({ schoolCode: 1, action: 1, createdAt: -1 });
auditLogSchema.index({ "actor.userCode": 1, createdAt: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });

// STRICT IMMUTABILITY GUARDS: Prevent any document updates or deletions
const preventMutation = function (next) {
  const err = new Error("SECURITY VIOLATION: Audit logs are immutable and cannot be updated, replaced, or deleted.");
  err.statusCode = 403;
  return next(err);
};

auditLogSchema.pre("updateOne", preventMutation);
auditLogSchema.pre("updateMany", preventMutation);
auditLogSchema.pre("findOneAndUpdate", preventMutation);
auditLogSchema.pre("replaceOne", preventMutation);
auditLogSchema.pre("deleteOne", preventMutation);
auditLogSchema.pre("deleteMany", preventMutation);
auditLogSchema.pre("findOneAndDelete", preventMutation);
auditLogSchema.pre("findOneAndRemove", preventMutation);

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

module.exports = AuditLog;
