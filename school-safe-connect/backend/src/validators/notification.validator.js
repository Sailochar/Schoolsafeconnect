/**
 * Notification Joi Validation Schemas
 */

const Joi = require("joi");

const notificationQuerySchema = Joi.object({
  page: Joi.string().pattern(/^\d+$/).optional().messages({
    "string.pattern.base": "page must be a positive integer"
  }),
  limit: Joi.string().pattern(/^\d+$/).optional().messages({
    "string.pattern.base": "limit must be a positive integer"
  }),
  status: Joi.string()
    .valid(
      "PENDING",
      "QUEUED",
      "PARTIAL",
      "SENT",
      "DELIVERED",
      "FAILED",
      "READ"
    )
    .optional(),
  eventType: Joi.string().optional(),
  unread: Joi.string().valid("true", "false").optional()
});

const markReadSchema = Joi.object({
  notificationId: Joi.string().required().messages({
    "any.required": "notificationId is required"
  })
});

const readAllSchema = Joi.object({});

const preferenceUpdateSchema = Joi.object({
  emailEnabled: Joi.boolean().optional(),
  smsEnabled: Joi.boolean().optional(),
  pushEnabled: Joi.boolean().optional(),
  whatsappEnabled: Joi.boolean().optional(),
  quietHours: Joi.object({
    enabled: Joi.boolean().optional(),
    startTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        "string.pattern.base": "startTime must be HH:mm"
      }),
    endTime: Joi.string()
      .pattern(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
      .optional()
      .messages({
        "string.pattern.base": "endTime must be HH:mm"
      })
  }).optional()
});

const deviceRegisterSchema = Joi.object({
  deviceId: Joi.string().required().messages({
    "any.required": "deviceId is required"
  }),
  fcmToken: Joi.string().optional().allow(""),
  deviceModel: Joi.string().optional(),
  osVersion: Joi.string().optional(),
  appVersion: Joi.string().optional(),
  platform: Joi.string().valid("ios", "android", "web", "unknown").optional()
});

const deviceUnregisterSchema = Joi.object({
  deviceId: Joi.string().required().messages({
    "any.required": "deviceId is required"
  })
});

module.exports = {
  notificationQuerySchema,
  markReadSchema,
  readAllSchema,
  preferenceUpdateSchema,
  deviceRegisterSchema,
  deviceUnregisterSchema
};
