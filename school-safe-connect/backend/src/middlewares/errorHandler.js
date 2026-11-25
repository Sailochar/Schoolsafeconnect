/**
 * Centralized Error Handling Middleware
 */

const logger = require("../utils/logger");
const config = require("../config/env");
const { sendError } = require("../utils/response");

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal Server Error";

  logger.error(`[ERROR] ${req.method} ${req.originalUrl} - ${err.message}`, {
    stack: err.stack,
    ip: req.ip
  });

  // Handle Mongoose Bad ObjectId / CastError
  if (err.name === "CastError") {
    statusCode = 400;
    message = `Resource not found with specified ID: ${err.value}`;
  }

  // Handle Mongoose Duplicate Key Error (code 11000)
  if (err.code === 11000) {
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0];
    message = `Duplicate field value entered for [${field}]. Please use another value.`;
  }

  // Handle Mongoose Validation Error
  if (err.name === "ValidationError") {
    statusCode = 400;
    message = Object.values(err.errors)
      .map((val) => val.message)
      .join(", ");
  }

  // Handle JWT Malformed / Expired
  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid authentication token.";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Authentication token expired.";
  }

  const details = config.IS_PRODUCTION ? undefined : err.stack;
  return sendError(res, message, statusCode, details);
};

module.exports = errorHandler;
