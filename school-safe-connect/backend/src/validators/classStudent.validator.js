/**
 * Class and Student Validation Schemas
 */

const Joi = require("joi");

const createClassSchema = Joi.object({
  grade: Joi.string().trim().required(),
  section: Joi.string().trim().uppercase().required(),
  academicYear: Joi.string().trim().required(),
  roomNumber: Joi.string().trim().optional().allow("", null),
  capacity: Joi.number().integer().min(1).default(40),
  maxCapacity: Joi.number().integer().min(1).optional(),
  cctvAccess: Joi.object({
    enabled: Joi.boolean().default(false),
    days: Joi.array()
      .items(Joi.string().valid("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"))
      .default(["MON", "TUE", "WED", "THU", "FRI"]),
    startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default("09:00"),
    endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).default("16:00"),
    timezone: Joi.string().default("Asia/Kolkata"),
    maxSessionMinutes: Joi.number().min(1).max(30).default(10),
    maxSessionsPerDay: Joi.number().min(1).max(20).default(5),
    cooldownMinutes: Joi.number().min(0).max(60).default(15),
    allowedCameraIds: Joi.array().items(Joi.string().trim()).default([]),
    requiresTeacherApproval: Joi.boolean().default(true)
  }).optional()
}).unknown(true);

const assignTeacherSchema = Joi.object({
  teacherCode: Joi.string().trim().uppercase().required(),
  isClassTeacher: Joi.boolean().default(false),
  subject: Joi.string().trim().optional().allow("", null),
  academicYear: Joi.string().trim().optional().allow("", null)
});

const updateCctvTimingSchema = Joi.object({
  enabled: Joi.boolean().required(),
  days: Joi.array()
    .items(Joi.string().valid("MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"))
    .min(1)
    .required(),
  startTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  endTime: Joi.string().pattern(/^([01]\d|2[0-3]):([0-5]\d)$/).required(),
  timezone: Joi.string().trim().default("Asia/Kolkata"),
  maxSessionMinutes: Joi.number().min(1).max(30).default(10),
  maxSessionsPerDay: Joi.number().min(1).max(20).default(5),
  cooldownMinutes: Joi.number().min(0).max(60).default(15),
  allowedCameraIds: Joi.array().items(Joi.string().trim()).optional().default([]),
  requiresTeacherApproval: Joi.boolean().optional()
});

const enrollStudentSchema = Joi.object({
  admissionNumber: Joi.string().trim().required(),
  fullName: Joi.string().trim().required(),
  dateOfBirth: Joi.date().iso().required(),
  gender: Joi.string().valid("MALE", "FEMALE", "OTHER").required(),
  classCode: Joi.string().trim().uppercase().required(),
  academicYear: Joi.string().trim().required(),
  busCode: Joi.string().trim().uppercase().optional().allow("", null),
  routeCode: Joi.string().trim().uppercase().optional().allow("", null),
  stopId: Joi.string().trim().optional().allow("", null),
  emergencyContacts: Joi.array()
    .items(
      Joi.object({
        name: Joi.string().trim().required(),
        phone: Joi.string().trim().required(),
        relationship: Joi.string().trim().required()
      })
    )
    .min(1)
    .required()
});

const studentCodeParamSchema = Joi.object({
  studentCode: Joi.string().trim().uppercase().required()
});

const linkParentSchema = Joi.object({
  parentCode: Joi.string().trim().uppercase().optional(),
  parentUserId: Joi.string().trim().hex().length(24).optional(),
  relationship: Joi.string().valid("FATHER", "MOTHER", "LEGAL_GUARDIAN", "OTHER").required(),
  isPrimaryContact: Joi.boolean().default(false),
  reason: Joi.string().trim().max(300).optional().allow("", null)
}).or("parentCode", "parentUserId");

const assignStudentClassSchema = Joi.object({
  classCode: Joi.string().trim().uppercase().required(),
  academicYear: Joi.string().trim().optional().allow("", null),
  reason: Joi.string().trim().max(300).optional().allow("", null)
});

const updateStudentTransportSchema = Joi.object({
  busCode: Joi.string().trim().uppercase().allow("", null),
  routeCode: Joi.string().trim().uppercase().allow("", null),
  stopId: Joi.string().trim().allow("", null),
  reason: Joi.string().trim().max(300).optional().allow("", null)
}).or("busCode", "routeCode", "stopId");

module.exports = {
  createClassSchema,
  assignTeacherSchema,
  updateCctvTimingSchema,
  enrollStudentSchema,
  studentCodeParamSchema,
  linkParentSchema,
  assignStudentClassSchema,
  updateStudentTransportSchema
};
