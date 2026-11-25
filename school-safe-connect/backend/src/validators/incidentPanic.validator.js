/**
 * Incident and Panic Alert Validators
 * Joi schemas for incident reporting, panic SOS triggering, status transitions, and listing filters.
 */

const Joi = require("joi");
const { INCIDENT_TYPES, INCIDENT_STATUS, PANIC_ALERT_STATUS } = require("../config/constants");

const attachmentSchema = Joi.object({
  fileName: Joi.string().trim().min(1).max(255).required(),
  fileUrl: Joi.string().trim().uri({ allowRelative: false }).required(),
  fileKey: Joi.string().trim().max(500).allow(null, "").optional(),
  fileType: Joi.string().trim().max(100).allow(null, "").optional(),
  fileSize: Joi.number().integer().min(0).max(50 * 1024 * 1024).optional()
});

const incidentTypeValues = Object.values(INCIDENT_TYPES);
const incidentStatusValues = Object.values(INCIDENT_STATUS);
const panicStatusValues = Object.values(PANIC_ALERT_STATUS);

const createIncidentSchema = Joi.object({
  type: Joi.string().trim().uppercase().valid(...incidentTypeValues).required(),
  severity: Joi.string().trim().uppercase().valid("LOW", "MEDIUM", "HIGH", "CRITICAL").default("MEDIUM"),
  classCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  busId: Joi.string().trim().max(100).optional().allow(null, ""),
  description: Joi.string().trim().min(10).max(5000).required(),
  attachments: Joi.array().items(attachmentSchema).max(10).default([])
});

const updateIncidentStatusSchema = Joi.object({
  status: Joi.string().trim().uppercase().valid(...incidentStatusValues).required(),
  remarks: Joi.string().trim().min(5).max(1000).required()
});

const triggerPanicSchema = Joi.object({
  confirmed: Joi.boolean().valid(true).required().strict(),
  location: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
    addressText: Joi.string().trim().max(500).allow(null, "").optional()
  }).optional(),
  remarks: Joi.string().trim().max(1000).allow(null, "").optional(),
  classCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  busId: Joi.string().trim().max(100).optional().allow(null, "")
});

const updatePanicStatusSchema = Joi.object({
  status: Joi.string().trim().uppercase().valid(...panicStatusValues).required(),
  remarks: Joi.string().trim().min(5).max(1000).required()
});

const incidentQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().trim().uppercase().valid(...incidentStatusValues).optional(),
  type: Joi.string().trim().uppercase().valid(...incidentTypeValues).optional(),
  severity: Joi.string().trim().uppercase().valid("LOW", "MEDIUM", "HIGH", "CRITICAL").optional(),
  classCode: Joi.string().trim().uppercase().optional(),
  busId: Joi.string().trim().optional(),
  reportedBy: Joi.string().trim().optional()
});

const panicQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().trim().uppercase().valid(...panicStatusValues).optional(),
  triggeredBy: Joi.string().trim().optional()
});

/**
 * Joi validation middleware factory.
 * @param {Object} schema - Joi schema
 * @param {string} source - 'body' | 'query' | 'params'
 */
const validate = (schema, source = "body") => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req[source] || {}, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: "Validation failed",
        timestamp: new Date().toISOString(),
        error: error.details.map((detail) => detail.message)
      });
    }

    req.validatedBody = value;
    next();
  };
};

module.exports = {
  attachmentSchema,
  createIncidentSchema,
  updateIncidentStatusSchema,
  triggerPanicSchema,
  updatePanicStatusSchema,
  incidentQuerySchema,
  panicQuerySchema,
  validate
};
