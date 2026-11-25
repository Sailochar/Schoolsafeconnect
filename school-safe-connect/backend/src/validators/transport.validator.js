/**
 * Transport Validators
 * Joi schemas for bus, route, stop, trip, telemetry, and transport access request flows.
 */

const Joi = require("joi");
const { TRIP_STATUS } = require("../config/constants");

const BUS_STATUS = Object.freeze({
  ACTIVE: "ACTIVE",
  MAINTENANCE: "MAINTENANCE",
  INACTIVE: "INACTIVE"
});

const ROUTE_STATUS = Object.freeze({
  DRAFT: "DRAFT",
  ACTIVE: "ACTIVE",
  INACTIVE: "INACTIVE"
});

const TRIP_TYPES = Object.freeze({
  MORNING_PICKUP: "MORNING_PICKUP",
  AFTERNOON_DROP: "AFTERNOON_DROP",
  SPECIAL: "SPECIAL"
});

const ACCESS_REQUEST_STATUS = Object.freeze({
  APPROVED: "APPROVED",
  REJECTED: "REJECTED"
});

const busStatusValues = Object.values(BUS_STATUS);
const routeStatusValues = Object.values(ROUTE_STATUS);
const tripTypeValues = Object.values(TRIP_TYPES);
const tripStatusValues = Object.values(TRIP_STATUS);
const accessRequestStatusValues = Object.values(ACCESS_REQUEST_STATUS);

const timePattern = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
const coordinatesSchema = Joi.array().ordered(Joi.number().min(-180).max(180), Joi.number().min(-90).max(90)).required();
const timeSchema = Joi.string().trim().pattern(timePattern);

const locationSchema = Joi.object({
  name: Joi.string().trim().min(1).max(255).required(),
  coordinates: coordinatesSchema
});

const createBusSchema = Joi.object({
  busNumber: Joi.string().trim().uppercase().min(1).max(50).optional().allow(null, ""),
  registrationNumber: Joi.string().trim().uppercase().min(1).max(50).required(),
  capacity: Joi.number().integer().min(1).required(),
  driverCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  routeCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  makeModel: Joi.string().trim().max(150).optional().allow(null, ""),
  gpsDeviceId: Joi.string().trim().max(100).optional().allow(null, "")
});

const updateBusSchema = Joi.object({
  busNumber: Joi.string().trim().uppercase().min(1).max(50).optional(),
  registrationNumber: Joi.string().trim().uppercase().min(1).max(50).optional(),
  capacity: Joi.number().integer().min(1).optional(),
  driverCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  routeCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  makeModel: Joi.string().trim().max(150).optional().allow(null, ""),
  gpsDeviceId: Joi.string().trim().max(100).optional().allow(null, ""),
  status: Joi.string().trim().uppercase().valid(...busStatusValues).optional()
});

const busQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().trim().uppercase().valid(...busStatusValues).optional()
});

const routeStopItemSchema = Joi.object({
  stopId: Joi.string().trim().max(100).optional().allow("", null),
  stopName: Joi.string().trim().min(1).max(150).required(),
  sequenceOrder: Joi.number().integer().min(1).default(1),
  scheduledPickupTime: timeSchema.default("07:30"),
  scheduledDropTime: timeSchema.default("15:30"),
  coordinates: coordinatesSchema
});

const createRouteSchema = Joi.object({
  routeName: Joi.string().trim().min(1).max(150).required(),
  startLocation: locationSchema.required(),
  endLocation: locationSchema.required(),
  busCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  driverCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  stops: Joi.array().items(Joi.alternatives().try(routeStopItemSchema, Joi.string().trim().max(150))).max(100).default([])
});

const updateRouteSchema = Joi.object({
  routeName: Joi.string().trim().min(1).max(150).optional(),
  startLocation: locationSchema.optional(),
  endLocation: locationSchema.optional(),
  busCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  driverCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  stops: Joi.array().items(Joi.alternatives().try(routeStopItemSchema, Joi.string().trim().max(150))).max(100).optional(),
  status: Joi.string().trim().uppercase().valid(...routeStatusValues).optional()
});

const routeQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().trim().uppercase().valid(...routeStatusValues).optional()
});

const createStopSchema = Joi.object({
  routeCode: Joi.string().trim().uppercase().min(1).max(100).required(),
  stopName: Joi.string().trim().min(1).max(150).required(),
  sequenceOrder: Joi.number().integer().min(1).required(),
  scheduledPickupTime: timeSchema.required(),
  scheduledDropTime: timeSchema.required(),
  coordinates: coordinatesSchema,
  assignedStudentCodes: Joi.array().items(Joi.string().trim().uppercase().max(100)).max(500).optional()
});

const updateStopSchema = Joi.object({
  stopName: Joi.string().trim().min(1).max(150).optional(),
  sequenceOrder: Joi.number().integer().min(1).optional(),
  scheduledPickupTime: timeSchema.optional(),
  scheduledDropTime: timeSchema.optional(),
  coordinates: coordinatesSchema.optional(),
  assignedStudentCodes: Joi.array().items(Joi.string().trim().uppercase().max(100)).max(500).optional()
});

const stopQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  routeCode: Joi.string().trim().uppercase().max(100).optional()
});

const tripStartSchema = Joi.object({
  busCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  routeCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  tripType: Joi.string().trim().uppercase().valid(...tripTypeValues).default("MORNING_PICKUP"),
  initialLocation: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required()
  }).optional().allow(null)
});

const tripStatusSchema = Joi.object({
  status: Joi.string().trim().uppercase().valid(...tripStatusValues).required(),
  currentStopId: Joi.string().trim().max(100).optional().allow(null, ""),
  delayedByMinutes: Joi.number().integer().min(0).optional(),
  delayReason: Joi.string().trim().max(1000).optional().allow(null, "")
});

const telemetrySchema = Joi.object({
  tripId: Joi.string().trim().max(100).required(),
  busCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  routeCode: Joi.string().trim().uppercase().max(100).optional().allow(null, ""),
  latitude: Joi.number().min(-90).max(90).required(),
  longitude: Joi.number().min(-180).max(180).required(),
  speedKmph: Joi.number().min(0).default(0),
  accuracyMeters: Joi.number().min(0).default(10),
  deviceTimestamp: Joi.date().iso().optional(),
  resetTrail: Joi.boolean().optional(),
  visibleNow: Joi.boolean().optional()
});

const transportAccessRequestApplySchema = Joi.object({
  studentCode: Joi.string().trim().uppercase().min(1).max(100).required(),
  routeCode: Joi.string().trim().uppercase().min(1).max(100).required(),
  busCode: Joi.string().trim().uppercase().min(1).max(100).required()
});

const transportAccessRequestReviewSchema = Joi.object({
  status: Joi.string().trim().uppercase().valid(...accessRequestStatusValues).required(),
  remarks: Joi.string().trim().min(5).max(1000).optional().allow(null, "")
});

const accessRequestQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(50),
  status: Joi.string().trim().uppercase().valid(...accessRequestStatusValues).optional()
});

/**
 * Joi validation middleware factory.
 * @param {Object} schema - Joi schema
 * @param {string} source - "body" | "query" | "params"
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
  BUS_STATUS,
  ROUTE_STATUS,
  TRIP_TYPES,
  ACCESS_REQUEST_STATUS,
  locationSchema,
  createBusSchema,
  updateBusSchema,
  busQuerySchema,
  createRouteSchema,
  updateRouteSchema,
  routeQuerySchema,
  createStopSchema,
  updateStopSchema,
  stopQuerySchema,
  tripStartSchema,
  tripStatusSchema,
  telemetrySchema,
  transportAccessRequestApplySchema,
  transportAccessRequestReviewSchema,
  accessRequestQuerySchema,
  validate
};

