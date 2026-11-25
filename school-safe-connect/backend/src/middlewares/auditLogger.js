/**
 * Audit Logger Middleware
 * Intercepts requests to automatically persist audit logs on successful execution.
 */

const AuditService = require("../services/audit.service");
const logger = require("../utils/logger");

/**
 * Creates an audit middleware for a specific action
 * @param {Object} options
 * @param {string} options.action
 * @param {string} options.resourceType
 * @param {Function} [options.extractResourceId] - (req) => resourceId
 * @param {Function} [options.extractReason] - (req) => reason
 * @param {Function} [options.extractMetadata] - (req) => metadata
 */
const auditLog = ({ action, resourceType, extractResourceId, extractReason, extractMetadata }) => {
  return async (req, res, next) => {
    // Intercept response finish
    const originalJson = res.json.bind(res);

    res.json = function (body) {
      res.json = originalJson;

      // Only audit on successful 2xx responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const actor = req.user
          ? {
            userCode: req.user.userCode,
            role: req.user.role,
            fullName: req.user.fullName,
            email: req.user.email
          }
          : { userCode: "ANONYMOUS", role: "ANONYMOUS" };

        const schoolCode = req.tenantSchoolCode || req.user?.schoolCode || "GLOBAL";
        const resourceId = extractResourceId ? extractResourceId(req, body) : req.params.id;
        const reason = extractReason ? extractReason(req) : req.body?.reason || req.headers["x-super-admin-reason"];
        const metadata = extractMetadata ? extractMetadata(req, body) : {};

        AuditService.log({
          schoolCode,
          actor,
          action,
          resourceType,
          resourceId,
          reason,
          ipAddress: req.ip || req.connection.remoteAddress,
          userAgent: req.headers["user-agent"],
          metadata
        }).catch((err) => {
          logger.error("Failed to log audit event in middleware:", err);
        });
      }

      return originalJson(body);
    };

    next();
  };
};

module.exports = {
  auditLog
};
