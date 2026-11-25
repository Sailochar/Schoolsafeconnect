/**
 * Authentication Middleware
 * Enforces JWT access-token verification and binds authenticated identity to req.user.
 */

const { verifyAccessToken } = require("../utils/token");
const { sendError } = require("../utils/response");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return sendError(res, "Authentication required. Bearer access token missing.", 401);
  }

  const token = authHeader.split(" ")[1];
  const decoded = verifyAccessToken(token);

  if (!decoded) {
    return sendError(res, "Invalid or expired access token. Please re-authenticate.", 401);
  }

  req.user = decoded;
  next();
};

module.exports = {
  authenticate
};
