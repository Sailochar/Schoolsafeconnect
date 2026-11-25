/**
 * JSON Web Token (JWT) Management Utility
 * Handles signing and verification for short-lived access tokens, refresh tokens,
 * 2FA temporary verification tokens, and CCTV signed stream tokens.
 */

const jwt = require("jsonwebtoken");
const config = require("../config/env");

/**
 * Signs short-lived access token (15 minutes)
 */
const signAccessToken = (payload) => {
  return jwt.sign(payload, config.JWT.ACCESS_SECRET, {
    expiresIn: config.JWT.ACCESS_EXPIRY,
    issuer: "school-safe-connect",
    audience: "ssc-client"
  });
};

/**
 * Signs rotating refresh token (7 days)
 */
const signRefreshToken = (payload) => {
  return jwt.sign(payload, config.JWT.REFRESH_SECRET, {
    expiresIn: config.JWT.REFRESH_EXPIRY,
    issuer: "school-safe-connect",
    audience: "ssc-client"
  });
};

/**
 * Signs temporary 2FA pending challenge token (5 minutes)
 */
const sign2FATempToken = (payload) => {
  return jwt.sign({ ...payload, purpose: "2FA_CHALLENGE" }, config.JWT.TEMP_2FA_SECRET, {
    expiresIn: config.JWT.TEMP_2FA_EXPIRY,
    issuer: "school-safe-connect"
  });
};

/**
 * Signs short-lived CCTV stream token (5 - 10 minutes)
 */
const signCctvStreamToken = (payload) => {
  return jwt.sign({ ...payload, purpose: "CCTV_STREAM_VIEW" }, config.JWT.CCTV_SECRET, {
    expiresIn: config.JWT.CCTV_EXPIRY,
    issuer: "school-safe-connect"
  });
};

/**
 * Verifies short-lived access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.JWT.ACCESS_SECRET, {
      issuer: "school-safe-connect",
      audience: "ssc-client"
    });
  } catch (error) {
    return null;
  }
};

/**
 * Verifies rotating refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.JWT.REFRESH_SECRET, {
      issuer: "school-safe-connect",
      audience: "ssc-client"
    });
  } catch (error) {
    return null;
  }
};

/**
 * Verifies 2FA challenge token
 */
const verify2FATempToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.JWT.TEMP_2FA_SECRET, {
      issuer: "school-safe-connect"
    });
    if (decoded.purpose !== "2FA_CHALLENGE") {return null;}
    return decoded;
  } catch (error) {
    return null;
  }
};

/**
 * Verifies CCTV stream token
 */
const verifyCctvStreamToken = (token) => {
  try {
    const decoded = jwt.verify(token, config.JWT.CCTV_SECRET, {
      issuer: "school-safe-connect"
    });
    if (decoded.purpose !== "CCTV_STREAM_VIEW") {return null;}
    return decoded;
  } catch (error) {
    return null;
  }
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  sign2FATempToken,
  signCctvStreamToken,
  verifyAccessToken,
  verifyRefreshToken,
  verify2FATempToken,
  verifyCctvStreamToken
};
