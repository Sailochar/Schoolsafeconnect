/**
 * Authentication Joi Validation Schemas
 */

const Joi = require("joi");
const { CLIENT_TYPES } = require("../config/constants");

const loginSchema = Joi.object({
  identifier: Joi.string().required().trim().messages({
    "any.required": "Identifier (email, phone, or userCode) is required",
    "string.empty": "Identifier cannot be empty"
  }),
  password: Joi.string().required().min(6).messages({
    "any.required": "Password is required",
    "string.min": "Password must be at least 6 characters"
  }),
  clientType: Joi.string().valid(...Object.values(CLIENT_TYPES)).optional().messages({
    "any.only": "clientType must be either WEB or MOBILE"
  })
});

const verify2FASchema = Joi.object({
  tempToken: Joi.string().trim().required().messages({
    "any.required": "2FA temporary challenge token is required",
    "string.empty": "2FA temporary challenge token cannot be empty"
  }),
  otp: Joi.string().trim().length(6).pattern(/^[0-9]+$/).required().messages({
    "string.length": "OTP must be exactly 6 digits",
    "string.pattern.base": "OTP must contain only numbers",
    "any.required": "OTP is required",
    "string.empty": "OTP cannot be empty"
  }),
  clientType: Joi.string().valid(...Object.values(CLIENT_TYPES)).optional(),
  deviceDetails: Joi.object({
    deviceId: Joi.string().optional(),
    deviceModel: Joi.string().optional(),
    osVersion: Joi.string().optional(),
    appVersion: Joi.string().optional(),
    fcmToken: Joi.string().optional().allow("")
  }).optional()
}).unknown(true);

const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required().messages({
    "any.required": "Refresh token is required"
  })
});

module.exports = {
  loginSchema,
  verify2FASchema,
  refreshTokenSchema
};
