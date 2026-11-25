/**
 * Multi-Tenant Isolation Middleware (tenantGuard.js)
 * Guarantees zero cross-tenant leakage.
 * Derives schoolCode strictly from the verified JWT identity.
 * Strictly checks and forbids any attempt to query or update other tenants.
 */

const { ROLES } = require("../config/constants");
const { sendError } = require("../utils/response");
const AuditService = require("../services/audit.service");
const logger = require("../utils/logger");

const tenantGuard = async (req, res, next) => {
  // 1. Verify authenticated user identity
  if (!req.user) {
    return sendError(res, "Unauthorized. Identity context is missing.", 401);
  }

  // 2. Handle Global Super Admin access
  if (req.user.role === ROLES.GLOBAL_SUPER_ADMIN) {
    // Super Admin must explicitly declare the target tenant via header
    const requestedTenant = req.headers["x-school-code"] || req.params.schoolCode || req.query.schoolCode;

    if (!requestedTenant) {
      // Global platform-level query (e.g. listing all tenants, platform analytics)
      req.tenantSchoolCode = "GLOBAL";
      return next();
    }

    // Super Admin tenant inspection requires a mandatory reason
    const reason = req.headers["x-super-admin-reason"] || req.body?.reason;
    if (!reason || String(reason).trim().length < 10) {
      return sendError(
        res,
        "Super Admin tenant inspection requires a mandatory justification reason (min 10 characters) in header X-Super-Admin-Reason.",
        400
      );
    }

    // Immutable audit trail for Super Admin tenant inspection
    await AuditService.log({
      schoolCode: requestedTenant,
      actor: {
        userCode: req.user.userCode,
        role: req.user.role,
        fullName: req.user.fullName,
        email: req.user.email
      },
      action: "SUPER_ADMIN_TENANT_INSPECTION",
      resourceType: "TENANT",
      resourceId: requestedTenant,
      reason,
      ipAddress: req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"],
      metadata: {
        path: req.originalUrl,
        method: req.method
      }
    });

    req.tenantSchoolCode = requestedTenant;
    return next();
  }

  // 3. For all school-scoped users: schoolCode is strictly locked to JWT
  const userSchoolCode = req.user.schoolCode;
  if (!userSchoolCode) {
    return sendError(res, "Security rejection: User is not linked to any valid school tenant.", 403);
  }

  // 4. Strict cross-tenant intrusion check: reject if client attempts to pass another schoolCode
  const paramSchool = req.params.schoolCode;
  const querySchool = req.query.schoolCode;
  const bodySchool = req.body?.schoolCode;

  if (
    (paramSchool && paramSchool !== userSchoolCode) ||
    (querySchool && querySchool !== userSchoolCode) ||
    (bodySchool && bodySchool !== userSchoolCode)
  ) {
    logger.warn(
      "SECURITY ALERT: Cross-tenant intrusion blocked! User " + req.user.userCode + " from " + userSchoolCode + " attempted to access tenant " + (paramSchool || querySchool || bodySchool)
    );

    await AuditService.log({
      schoolCode: userSchoolCode,
      actor: {
        userCode: req.user.userCode,
        role: req.user.role,
        fullName: req.user.fullName,
        email: req.user.email
      },
      action: "CROSS_TENANT_ACCESS_ATTEMPT_BLOCKED",
      resourceType: "TENANT",
      resourceId: paramSchool || querySchool || bodySchool,
      reason: "Cross-tenant payload detected and blocked",
      ipAddress: req.ip || req.socket?.remoteAddress || req.connection?.remoteAddress || "unknown",
      userAgent: req.headers["user-agent"],
      metadata: {
        targetSchoolCode: paramSchool || querySchool || bodySchool,
        path: req.originalUrl
      }
    });

    return sendError(
      res,
      "CROSS-TENANT ACCESS FORBIDDEN: You are strictly prohibited from accessing another school tenant.",
      403
    );
  }

  // 5. Securely bind verified tenantSchoolCode to req for controller database queries
  req.tenantSchoolCode = userSchoolCode;
  next();
};

module.exports = tenantGuard;
