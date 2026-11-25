/**
 * Standardized API Response Envelope
 */

const sendResponse = (res, statusCode, success, message, data = null, meta = null) => {
  const payload = {
    success,
    message,
    timestamp: new Date().toISOString()
  };

  if (data !== null) {
    payload.data = data;
  }

  if (meta !== null) {
    payload.meta = meta;
  }

  return res.status(statusCode).json(payload);
};

const sendSuccess = (res, message = "Operation successful", data = null, meta = null, statusCode = 200) => {
  return sendResponse(res, statusCode, true, message, data, meta);
};

const sendCreated = (res, message = "Resource created successfully", data = null) => {
  return sendResponse(res, 201, true, message, data);
};

const sendError = (res, message = "Internal Server Error", statusCode = 500, errorDetails = null) => {
  const payload = {
    success: false,
    message,
    timestamp: new Date().toISOString()
  };

  if (errorDetails) {
    payload.error = errorDetails;
  }

  return res.status(statusCode).json(payload);
};

module.exports = {
  sendSuccess,
  sendCreated,
  sendError
};
