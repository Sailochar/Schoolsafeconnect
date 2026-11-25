/**
 * ClassTeacher Model
 * Associates teachers with classes and tracks who serves as the designated Class Teacher
 * (authorized to approve/reject parent requests for their assigned class).
 */

const mongoose = require("mongoose");

const classTeacherSchema = new mongoose.Schema(
  {
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
      uppercase: true,
      index: true
    },
    teacherCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      index: true // e.g. SSC-SCH-1023-TCH-001
    },
    isClassTeacher: {
      type: Boolean,
      default: true // Designates the primary Class Teacher
    },
    subject: {
      type: String,
      trim: true
    },
    academicYear: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ["ACTIVE", "INACTIVE"],
      default: "ACTIVE"
    }
  },
  {
    timestamps: true
  }
);

classTeacherSchema.index({ schoolCode: 1, classCode: 1, teacherCode: 1 }, { unique: true });
classTeacherSchema.index({ schoolCode: 1, teacherCode: 1, status: 1 });

const ClassTeacher = mongoose.model("ClassTeacher", classTeacherSchema);

module.exports = ClassTeacher;
