/**
 * School Model (Tenant Root)
 * Defines the school tenant profile, state, and master feature toggles.
 */

const mongoose = require("mongoose");
const { SCHOOL_STATUS } = require("../config/constants");

const schoolSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023
    },
    name: {
      type: String,
      required: true,
      trim: true
    },
    board: {
      type: String,
      required: true,
      trim: true // CBSE, ICSE, IB, State Board, etc.
    },
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true },
      state: { type: String, required: true },
      postalCode: { type: String, required: true },
      country: { type: String, default: "India" }
    },
    contactPerson: {
      name: { type: String, required: true },
      phone: { type: String, required: true },
      email: { type: String, required: true, lowercase: true }
    },
    status: {
      type: String,
      enum: Object.values(SCHOOL_STATUS),
      default: SCHOOL_STATUS.PENDING,
      index: true
    },
    approvalDetails: {
      approvedBy: { type: String }, // userCode of Super Admin
      approvedAt: { type: Date },
      reason: { type: String }
    },
    suspensionDetails: {
      suspendedBy: { type: String },
      suspendedAt: { type: Date },
      reason: { type: String }
    },
    settings: {
      cctvGlobalEnabled: { type: Boolean, default: true },
      transportGlobalEnabled: { type: Boolean, default: true },
      defaultDelayedVisibilitySeconds: { type: Number, default: 30, min: 10, max: 60 },
      timezone: { type: String, default: "Asia/Kolkata" },
      maxActiveCctvSessionsPerUser: { type: Number, default: 1 },
      whatsapp: {
        connected: { type: Boolean, default: false },
        phoneNumber: { type: String, default: "" },
        businessAccountId: { type: String, default: "" },
        apiKey: { type: String, default: "" },
        connectedAt: { type: Date },
        status: { type: String, enum: ["CONNECTED", "DISCONNECTED", "PENDING"], default: "DISCONNECTED" }
      }
    },
    studentCount: {
      type: Number,
      default: 0
    },
    teacherCount: {
      type: Number,
      default: 0
    },
    busCount: {
      type: Number,
      default: 0
    },
    cameraCount: {
      type: Number,
      default: 0
    }
  },
  {
    timestamps: true
  }
);

schoolSchema.index({ schoolCode: 1, status: 1 });

const School = mongoose.model("School", schoolSchema);

module.exports = School;
