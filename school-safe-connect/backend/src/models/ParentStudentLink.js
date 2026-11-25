/**
 * ParentStudentLink Model
 * Establishes and validates the verified mapping between a parent and their child.
 */

const mongoose = require("mongoose");
const { PARENT_VERIFICATION_STATUS } = require("../config/constants");

const parentStudentLinkSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    parentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-PAR-015
    },
    studentCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-STU-102
    },
    relationship: {
      type: String,
      enum: ["FATHER", "MOTHER", "LEGAL_GUARDIAN", "OTHER"],
      required: true
    },
    isPrimaryContact: {
      type: Boolean,
      default: true
    },
    status: {
      type: String,
      enum: Object.values(PARENT_VERIFICATION_STATUS),
      default: PARENT_VERIFICATION_STATUS.PENDING,
      index: true
    },
    verifiedBy: {
      type: String // School Admin userCode
    },
    verifiedAt: {
      type: Date
    },
    rejectionReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

parentStudentLinkSchema.index({ schoolCode: 1, parentCode: 1, studentCode: 1 }, { unique: true });
parentStudentLinkSchema.index({ schoolCode: 1, studentCode: 1 });

const ParentStudentLink = mongoose.model("ParentStudentLink", parentStudentLinkSchema);

module.exports = ParentStudentLink;
