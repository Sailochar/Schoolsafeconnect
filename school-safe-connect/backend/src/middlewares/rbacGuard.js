/**
 * Role-Based Access Control (RBAC) Middleware
 * Enforces role boundaries, client platform separation (Web vs Mobile),
 * active account verification, and specialized functional checks.
 */

const { ROLES, USER_STATUS, PARENT_VERIFICATION_STATUS, WEB_ROLES, MOBILE_ROLES } = require("../config/constants");
const { sendError } = require("../utils/response");
const { User, ClassTeacher, ParentStudentLink } = require("../models");

/**
 * Ensures authenticated user has one of the specified roles
 * @param {...string} allowedRoles
 */
const authorizeRoles = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return sendError(res, "Authentication required before role verification.", 401);
    }

    if (!allowedRoles.includes(req.user.role)) {
      return sendError(
        res,
        `Access denied. Role [${req.user.role}] is not authorized for this resource. Required: ${allowedRoles.join(", ")}`,
        403
      );
    }

    next();
  };
};

/**
 * Enforces that only Web Application users (Global Super Admin, School Admin, Transport Coordinator)
 * can access administrative web endpoints.
 */
const enforceWebClientOnly = (req, res, next) => {
  if (!req.user) {
    return sendError(res, "Authentication required.", 401);
  }

  if (!WEB_ROLES.includes(req.user.role)) {
    return sendError(
      res,
      "Access Denied: Mobile users (Parents, Teachers, Drivers) must not access administrative web dashboards.",
      403
    );
  }

  next();
};

/**
 * Enforces that only Mobile Application users (Parents, Teachers, Drivers)
 * can access mobile field endpoints.
 */
const enforceMobileClientOnly = (req, res, next) => {
  if (!req.user) {
    return sendError(res, "Authentication required.", 401);
  }

  if (!MOBILE_ROLES.includes(req.user.role)) {
    return sendError(
      res,
      "Access Denied: Web administrative users must not use the mobile application for administrative functions.",
      403
    );
  }

  next();
};

/**
 * Checks that the user is ACTIVE in the database
 */
const requireActiveStatus = async (req, res, next) => {
  if (req.user.role === ROLES.GLOBAL_SUPER_ADMIN) {
    return next();
  }

  const user = await User.findOne({ userCode: req.user.userCode, schoolCode: req.tenantSchoolCode });
  if (!user || user.status !== USER_STATUS.ACTIVE) {
    return sendError(res, "Access denied. Account is not active or has been suspended.", 403);
  }

  req.currentUserDoc = user;
  next();
};

/**
 * Verifies parent status is VERIFIED before granting CCTV or transport routes
 */
const requireVerifiedParent = async (req, res, next) => {
  if (req.user.role !== ROLES.PARENT) {
    return next(); // Non-parents pass through
  }

  const user = req.currentUserDoc || (await User.findOne({ userCode: req.user.userCode, schoolCode: req.tenantSchoolCode }));
  if (!user || user.verificationDetails?.status !== PARENT_VERIFICATION_STATUS.VERIFIED) {
    return sendError(
      res,
      "Access denied. Parent verification by School Admin is pending or incomplete.",
      403
    );
  }

  next();
};

/**
 * Enforces that a Class Teacher can only act on their own assigned class
 */
const requireAssignedClassTeacher = async (req, res, next) => {
  if (req.user.role === ROLES.SCHOOL_ADMIN || req.user.role === ROLES.GLOBAL_SUPER_ADMIN) {
    return next(); // School Admin has master override
  }

  if (req.user.role !== ROLES.CLASS_TEACHER) {
    return sendError(res, "Access denied. Only designated Class Teachers may perform this routing action.", 403);
  }

  const classCode = req.params.classCode || req.body?.classCode || req.query?.classCode;
  if (!classCode) {
    return sendError(res, "Target classCode must be specified.", 400);
  }

  const assignment = await ClassTeacher.findOne({
    schoolCode: req.tenantSchoolCode,
    classCode,
    teacherCode: req.user.userCode,
    isClassTeacher: true,
    status: "ACTIVE"
  });

  if (!assignment) {
    return sendError(
      res,
      `Permission denied: You are not the assigned Class Teacher for class [${classCode}].`,
      403
    );
  }

  next();
};

/**
 * Ensures parent is linked to the specified student
 */
const requireParentOfStudent = async (req, res, next) => {
  if (req.user.role !== ROLES.PARENT) {
    return next();
  }

  const studentCode = req.params.studentCode || req.body?.studentCode || req.query?.studentCode;
  if (!studentCode) {
    return sendError(res, "Target studentCode must be specified.", 400);
  }

  const link = await ParentStudentLink.findOne({
    schoolCode: req.tenantSchoolCode,
    parentCode: req.user.userCode,
    studentCode,
    status: PARENT_VERIFICATION_STATUS.VERIFIED
  });

  if (!link) {
    return sendError(
      res,
      `Forbidden: You do not have verified parental custody for student [${studentCode}].`,
      403
    );
  }

  req.parentStudentLink = link;
  next();
};

module.exports = {
  authorizeRoles,
  enforceWebClientOnly,
  enforceMobileClientOnly,
  requireActiveStatus,
  requireVerifiedParent,
  requireAssignedClassTeacher,
  requireParentOfStudent
};
