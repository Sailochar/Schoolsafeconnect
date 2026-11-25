/**
 * School Admin Joi Validation Schemas
 * All identity-related fields (schoolCode, role, userCode) are intentionally
 * excluded from client payloads: they are derived server-side from the JWT
 * tenant context and never trusted from the frontend.
 */

const Joi = require("joi");

const approveUserSchema = Joi.object({
  userId: Joi.string().required().messages({
    "any.required": "Target userId is required"
  }),
  isClassTeacher: Joi.boolean().optional().default(false),
  classCode: Joi.string().trim().uppercase().optional().allow("", null),
  subject: Joi.string().trim().optional().allow("", null)
});

const verifyParentSchema = Joi.object({
  userId: Joi.string().required().messages({
    "any.required": "Target parent userId is required"
  }),
  parentFullName: Joi.string().required().trim().min(2).max(100).messages({
    "any.required": "Parent full name is required",
    "string.min": "Parent full name must be at least 2 characters"
  }),
  parentMobile: Joi.string().required().trim().min(10).max(20).messages({
    "any.required": "Parent mobile number is required",
    "string.min": "Parent mobile number is invalid"
  }),
  parentEmail: Joi.string().required().email().lowercase().trim().max(200).messages({
    "any.required": "Parent email is required",
    "string.email": "Parent email must be a valid email address"
  }),
  studentAdmissionNumber: Joi.string().required().trim().min(3).messages({
    "any.required": "Student admission number is required"
  }),
  childFullName: Joi.string().required().trim().min(2).max(100).messages({
    "any.required": "Child full name is required",
    "string.min": "Child full name must be at least 2 characters"
  }),
  childGrade: Joi.string().required().trim().min(1).max(3).messages({
    "any.required": "Child class/grade is required"
  }),
  childSection: Joi.string().required().trim().min(1).max(2).messages({
    "any.required": "Child section is required"
  }),
  relationship: Joi.string()
    .valid("FATHER", "MOTHER", "LEGAL_GUARDIAN", "OTHER")
    .required()
    .messages({
      "any.required": "Relationship to child is required",
      "any.only": "Relationship must be one of FATHER, MOTHER, LEGAL_GUARDIAN, OTHER"
    }),
  consentAccepted: Joi.boolean()
    .valid(true)
    .required()
    .messages({
      "any.required": "Parental consent acceptance is mandatory",
      "any.only": "Parental consent must be explicitly accepted (true)"
    }),
  verificationNotes: Joi.string().optional().trim().max(1000)
});

const linkStudentSchema = Joi.object({
  userId: Joi.string().required().messages({
    "any.required": "Target parent userId is required"
  }),
  studentAdmissionNumber: Joi.string().required().trim().min(3).messages({
    "any.required": "Student admission number is required"
  }),
  childFullName: Joi.string().required().trim().min(2).max(100).messages({
    "any.required": "Child full name is required"
  }),
  childGrade: Joi.string().required().trim().min(1).max(3).messages({
    "any.required": "Child class/grade is required"
  }),
  childSection: Joi.string().required().trim().min(1).max(2).messages({
    "any.required": "Child section is required"
  }),
  relationship: Joi.string()
    .valid("FATHER", "MOTHER", "LEGAL_GUARDIAN", "OTHER")
    .required()
});

const rejectUserSchema = Joi.object({
  userId: Joi.string().required(),
  reason: Joi.string().min(5).required().messages({
    "string.min": "Rejection reason must be at least 5 characters long",
    "any.required": "Rejection reason is required"
  })
});

const userStateSchema = Joi.object({
  reason: Joi.string().min(5).required()
});

module.exports = {
  approveUserSchema,
  verifyParentSchema,
  linkStudentSchema,
  rejectUserSchema,
  userStateSchema
};
