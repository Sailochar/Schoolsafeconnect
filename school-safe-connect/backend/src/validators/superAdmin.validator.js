/**
 * Super Admin Validation Schemas
 */

const Joi = require("joi");

const onboardingSubmissionSchema = Joi.object({
  schoolName: Joi.string().required().trim(),
  board: Joi.string().required().trim(),
  address: Joi.object({
    street: Joi.string().required(),
    city: Joi.string().required(),
    state: Joi.string().required(),
    postalCode: Joi.string().required(),
    country: Joi.string().default("India")
  }).required(),
  contactPerson: Joi.object({
    name: Joi.string().required(),
    phone: Joi.string().required(),
    email: Joi.string().email().required().lowercase()
  }).required(),
  expectedStudents: Joi.number().integer().min(1).required(),
  proposedAdminDetails: Joi.object({
    fullName: Joi.string().required(),
    email: Joi.string().email().required().lowercase(),
    phone: Joi.string().required(),
    password: Joi.string().min(8).optional()
  }).required(),
  documents: Joi.array().items(
    Joi.object({
      title: Joi.string().required(),
      fileUrl: Joi.string().uri().required(),
      fileKey: Joi.string().optional()
    })
  ).optional()
});

const approveSchoolSchema = Joi.object({
  requestId: Joi.string().required(),
  reason: Joi.string().min(10).required().messages({
    "string.min": "Mandatory approval reason must be at least 10 characters long.",
    "any.required": "Approval reason is mandatory."
  })
});

const rejectSchoolSchema = Joi.object({
  requestId: Joi.string().required(),
  reason: Joi.string().min(10).required().messages({
    "string.min": "Mandatory rejection reason must be at least 10 characters long.",
    "any.required": "Rejection reason is mandatory."
  })
});

const tenantStateChangeSchema = Joi.object({
  reason: Joi.string().min(10).required()
});

const removeAdminSchema = Joi.object({
  confirmationText: Joi.string().required(),
  reason: Joi.string().min(10).required()
});

module.exports = {
  onboardingSubmissionSchema,
  approveSchoolSchema,
  rejectSchoolSchema,
  tenantStateChangeSchema,
  removeAdminSchema
};
