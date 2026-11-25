/**
 * OnboardingRequest Model
 * Tracks prospective school registration submissions prior to Global Super Admin review.
 */

const mongoose = require("mongoose");
const { SCHOOL_STATUS } = require("../config/constants");

const onboardingRequestSchema = new mongoose.Schema(
  {
    requestId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    schoolName: {
      type: String,
      required: true,
      trim: true
    },
    board: {
      type: String,
      required: true,
      trim: true
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
    expectedStudents: {
      type: Number,
      required: true,
      min: 1
    },
    proposedAdminDetails: {
      fullName: { type: String, required: true },
      email: { type: String, required: true, lowercase: true },
      phone: { type: String, required: true },
      desiredPassword: { type: String, select: false }
    },
    documents: [
      {
        title: { type: String, required: true },
        fileUrl: { type: String, required: true },
        fileKey: { type: String },
        uploadedAt: { type: Date, default: Date.now }
      }
    ],
    status: {
      type: String,
      enum: [SCHOOL_STATUS.PENDING, SCHOOL_STATUS.APPROVED, SCHOOL_STATUS.REJECTED],
      default: SCHOOL_STATUS.PENDING,
      index: true
    },
    approvalReason: {
      type: String
    },
    rejectionReason: {
      type: String
    },
    reviewDetails: {
      reviewedBy: { type: String }, // Super Admin userCode
      reviewedAt: { type: Date }
    },
    allocatedSchoolCode: {
      type: String
    },
    allocatedAdminCode: {
      type: String
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

onboardingRequestSchema.index({ status: 1, createdAt: -1 });

const OnboardingRequest = mongoose.model("OnboardingRequest", onboardingRequestSchema);

module.exports = OnboardingRequest;
