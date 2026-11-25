/**
 * SuperAdmin Model (Global Super Admin)
 * Highest-level platform operator. Isolated from individual school tenants.
 */

const mongoose = require("mongoose");
const { ROLES } = require("../config/constants");

const superAdminSchema = new mongoose.Schema(
  {
    userCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      default: "SSC-GSA-001"
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    role: {
      type: String,
      enum: [ROLES.GLOBAL_SUPER_ADMIN],
      default: ROLES.GLOBAL_SUPER_ADMIN
    },
    status: {
      type: String,
      enum: ["ACTIVE", "SUSPENDED"],
      default: "ACTIVE"
    },
    twoFactor: {
      secret: { type: String, select: false },
      method: { type: String, enum: ["AUTHENTICATOR", "SMS", "EMAIL"], default: "AUTHENTICATOR" },
      isVerified: { type: Boolean, default: true },
      otpCodeHash: { type: String, select: false },
      otpExpiresAt: { type: Date },
      otpAttempts: { type: Number, default: 0 },
      cooldownUntil: { type: Date }
    },
    currentDeviceId: { type: String },
    lastLoginAt: { type: Date },
    failedLoginAttempts: { type: Number, default: 0 },
    lockUntil: { type: Date }
  },
  {
    timestamps: true
  }
);

superAdminSchema.index({ email: 1 });
superAdminSchema.index({ userCode: 1 });

const SuperAdmin = mongoose.model("SuperAdmin", superAdminSchema);

module.exports = SuperAdmin;
