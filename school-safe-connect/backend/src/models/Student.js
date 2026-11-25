/**
 * Student Model
 * Tenant-scoped student profile.
 */

const mongoose = require("mongoose");
const { STUDENT_STATUS } = require("../config/constants");

const studentSchema = new mongoose.Schema(
  {
    schoolCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true
    },
    studentCode: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-STU-102
    },
    admissionNumber: {
      type: String,
      required: true,
      trim: true
    },
    fullName: {
      type: String,
      required: true,
      trim: true
    },
    dateOfBirth: {
      type: Date,
      required: true
    },
    gender: {
      type: String,
      enum: ["MALE", "FEMALE", "OTHER"],
      required: true
    },
    classCode: {
      type: String,
      required: true,
      index: true // e.g. SSC-SCH-1023-CLS-6A
    },
    section: {
      type: String,
      required: true,
      trim: true
    },
    academicYear: {
      type: String,
      required: true,
      index: true // e.g. 2026-2027
    },
    busCode: {
      type: String,
      index: true
    },
    routeCode: {
      type: String,
      index: true
    },
    stopId: {
      type: String
    },
    emergencyContacts: [
      {
        name: { type: String, required: true },
        phone: { type: String, required: true },
        relationship: { type: String, required: true }
      }
    ],
    status: {
      type: String,
      enum: Object.values(STUDENT_STATUS),
      default: STUDENT_STATUS.ACTIVE,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Compound indexes for fast tenant and class lookups
studentSchema.index({ schoolCode: 1, admissionNumber: 1 }, { unique: true });
studentSchema.index({ schoolCode: 1, classCode: 1, status: 1 });
studentSchema.index({ schoolCode: 1, busCode: 1 });

const Student = mongoose.model("Student", studentSchema);

module.exports = Student;
