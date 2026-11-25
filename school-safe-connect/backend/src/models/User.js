/**
 * User Model
 * Represents all tenant-scoped users (School Admin, Teachers, Parents, Drivers, Transport Coordinators).
 * Isolated strictly by schoolCode.
 */

const mongoose = require("mongoose");
const { ROLES, USER_STATUS, PARENT_VERIFICATION_STATUS, TWO_FACTOR_METHODS } = require("../config/constants");

const userSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    userCode: {
      type: String,
      trim: true,
      uppercase: true
    },
    role: {
      type: String,
      required: true,
      enum: [
        ROLES.SCHOOL_ADMIN,
        ROLES.TRANSPORT_COORDINATOR,
        ROLES.CLASS_TEACHER,
        ROLES.SUBJECT_TEACHER,
        ROLES.PARENT,
        ROLES.DRIVER
      ],
      index: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
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
    status: {
      type: String,
      enum: Object.values(USER_STATUS),
      default: USER_STATUS.PENDING,
      index: true
    },
    twoFactor: {
      secret: { type: String, select: false },
      method: {
        type: String,
        enum: Object.values(TWO_FACTOR_METHODS),
        default: TWO_FACTOR_METHODS.SMS
      },
      isVerified: { type: Boolean, default: false },
      otpCodeHash: { type: String, select: false },
      otpExpiresAt: { type: Date },
      otpAttempts: { type: Number, default: 0 },
      cooldownUntil: { type: Date }
    },
    verificationDetails: {
      status: {
        type: String,
        enum: Object.values(PARENT_VERIFICATION_STATUS),
        default: PARENT_VERIFICATION_STATUS.PENDING
      },
      verifiedBy: { type: String }, // School Admin userCode
      verifiedAt: { type: Date },
      verificationNotes: { type: String },
      consentAccepted: { type: Boolean, default: false },
      consentAcceptedAt: { type: Date },
      // Applicant provided data for parents during signup:
      submittedAdmissionNumber: { type: String },
      submittedChildName: { type: String },
      submittedGrade: { type: String },
      submittedSection: { type: String },
      submittedRelationship: { type: String }
    },
    // Access controls granted/managed by School Admin (CCTV, Bus Location)
    accessControls: {
      cctvEnabled: { type: Boolean, default: true },
      cctvClassCode: { type: String },
      transportEnabled: { type: Boolean, default: true },
      transportBusCode: { type: String }
    },
    // Daily query throttling for Parents (1 normal query per day to class teacher)
    dailyQueryCount: {
      type: Number,
      default: 0
    },
    dailyQueryDate: {
      type: String // YYYY-MM-DD
    },
    currentDeviceId: {
      type: String
    },
    trustedDevices: [
      {
        deviceId: { type: String, required: true },
        deviceModel: { type: String },
        registeredAt: { type: Date, default: Date.now }
      }
    ],
    lastLoginAt: {
      type: Date
    },
    failedLoginAttempts: {
      type: Number,
      default: 0
    },
    lockUntil: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for multi-tenant queries
userSchema.index(
  { userCode: 1 },
  { unique: true, partialFilterExpression: { userCode: { $type: "string" } } }
);
userSchema.index({ schoolCode: 1, role: 1, status: 1 });
userSchema.index({ schoolCode: 1, email: 1 }, { unique: true });
userSchema.index({ schoolCode: 1, phone: 1 });

const User = mongoose.model("User", userSchema);

module.exports = User;
