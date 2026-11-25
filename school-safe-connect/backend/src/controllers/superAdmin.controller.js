/**
 * Super Admin Controller
 * Manages school onboarding evaluation, tenant approvals, tenant suspensions,
 * School Admin removal, and platform overview.
 */

const SchoolApprovalService = require("../services/schoolApproval.service");
const {
  onboardingSubmissionSchema,
  approveSchoolSchema,
  rejectSchoolSchema,
  tenantStateChangeSchema,
  removeAdminSchema
} = require("../validators/superAdmin.validator");
const { School, AuditLog } = require("../models");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class SuperAdminController {
  /**
   * Public onboarding registration submission
   * POST /api/v1/onboarding/apply
   */
  static async submitOnboarding(req, res, next) {
    try {
      const { error, value } = onboardingSubmissionSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const request = await SchoolApprovalService.submitOnboardingRequest({
        data: value,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "School onboarding request submitted successfully. Awaiting Super Admin review.", request);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/onboarding-requests
   */
  static async listOnboardingRequests(req, res, next) {
    try {
      const { status, page, limit } = req.query;
      const result = await SchoolApprovalService.getOnboardingRequests({
        status,
        page: parseInt(page || "1", 10),
        limit: parseInt(limit || "20", 10)
      });
      return sendSuccess(res, "Onboarding requests retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/schools/approve
   */
  static async approveSchool(req, res, next) {
    try {
      const { error, value } = approveSchoolSchema.validate(req.body);
      if (error) {
        return sendError(res, error.details[0].message, 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await SchoolApprovalService.approveSchoolRequest({
        requestId: value.requestId,
        reason: value.reason,
        superAdmin: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "School onboarding request approved and tenant initialized.", result, null, 201);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/schools/reject
   */
  static async rejectSchool(req, res, next) {
    try {
      const { error, value } = rejectSchoolSchema.validate(req.body);
      if (error) {
        return sendError(res, error.details[0].message, 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await SchoolApprovalService.rejectSchoolRequest({
        requestId: value.requestId,
        reason: value.reason,
        superAdmin: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "School onboarding request rejected.", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/schools
   * List all school tenants
   */
  static async listSchools(req, res, next) {
    try {
      const schools = await School.find().sort({ createdAt: -1 });
      return sendSuccess(res, "School tenants retrieved.", { schools, count: schools.length });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/super-admin/schools/:schoolCode/suspend
   */
  static async suspendSchool(req, res, next) {
    try {
      const { error, value } = tenantStateChangeSchema.validate(req.body);
      if (error) {
        return sendError(res, error.details[0].message, 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const school = await SchoolApprovalService.suspendSchoolTenant({
        schoolCode: req.params.schoolCode,
        reason: value.reason,
        superAdmin: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, `School tenant [${req.params.schoolCode}] has been suspended.`, school);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/super-admin/schools/:schoolCode/activate
   */
  static async activateSchool(req, res, next) {
    try {
      const { error, value } = tenantStateChangeSchema.validate(req.body);
      if (error) {
        return sendError(res, error.details[0].message, 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const school = await SchoolApprovalService.activateSchoolTenant({
        schoolCode: req.params.schoolCode,
        reason: value.reason,
        superAdmin: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, `School tenant [${req.params.schoolCode}] has been activated.`, school);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/super-admin/schools/:schoolCode/admins/:adminUserCode/remove
   * Section 20 two-step removal
   */
  static async removeAdmin(req, res, next) {
    try {
      const { error, value } = removeAdminSchema.validate(req.body);
      if (error) {
        return sendError(res, error.details[0].message, 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await SchoolApprovalService.removeSchoolAdmin({
        schoolCode: req.params.schoolCode,
        adminUserCode: req.params.adminUserCode,
        confirmationText: value.confirmationText,
        reason: value.reason,
        superAdmin: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, result.message, result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/audit-logs
   */
  static async getAuditLogs(req, res, next) {
    try {
      const { schoolCode, action, page = 1, limit = 50 } = req.query;
      const query = {};
      if (schoolCode) {query.schoolCode = schoolCode;}
      if (action) {query.action = action;}

      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const [logs, total] = await Promise.all([
        AuditLog.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)),
        AuditLog.countDocuments(query)
      ]);

      return sendSuccess(res, "Audit logs retrieved.", {
        logs,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/super-admin/onboarding-requests/:requestId
   * Updates/modifies onboarding school details and admin details
   */
  static async updateOnboardingRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const { OnboardingRequest } = require("../models");
      const request = await OnboardingRequest.findOne({ requestId });

      if (!request) {
        return sendError(res, "Onboarding request not found.", 404);
      }

      const {
        schoolName,
        board,
        expectedStudents,
        address,
        proposedAdminDetails,
        contactPerson
      } = req.body;

      if (schoolName) request.schoolName = schoolName;
      if (board) request.board = board;
      if (expectedStudents) request.expectedStudents = Number(expectedStudents);
      if (address) {
        request.address = {
          street: address.street || request.address.street,
          city: address.city || request.address.city,
          state: address.state || request.address.state,
          postalCode: address.postalCode || request.address.postalCode,
          country: address.country || request.address.country || "India"
        };
      }
      if (proposedAdminDetails) {
        request.proposedAdminDetails.fullName = proposedAdminDetails.fullName || request.proposedAdminDetails.fullName;
        request.proposedAdminDetails.email = proposedAdminDetails.email ? proposedAdminDetails.email.toLowerCase() : request.proposedAdminDetails.email;
        request.proposedAdminDetails.phone = proposedAdminDetails.phone || request.proposedAdminDetails.phone;
        if (proposedAdminDetails.password) {
          request.proposedAdminDetails.desiredPassword = proposedAdminDetails.password;
        }
      }
      if (contactPerson) {
        request.contactPerson = {
          name: contactPerson.name || request.contactPerson.name,
          phone: contactPerson.phone || request.contactPerson.phone,
          email: contactPerson.email ? contactPerson.email.toLowerCase() : request.contactPerson.email
        };
      }

      await request.save();

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const AuditService = require("../services/audit.service");

      await AuditService.log({
        schoolCode: "GLOBAL",
        actor: { userCode: req.user.userCode, email: req.user.email },
        action: "ONBOARDING_REQUEST_MODIFIED",
        resourceType: "ONBOARDING_REQUEST",
        resourceId: requestId,
        ipAddress,
        userAgent,
        metadata: { schoolName: request.schoolName, adminEmail: request.proposedAdminDetails.email }
      });

      return sendSuccess(res, "School registration details updated successfully.", request);
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/super-admin/onboarding-requests/:requestId
   * Deletes a rejected or pending onboarding application
   */
  static async deleteOnboardingRequest(req, res, next) {
    try {
      const { requestId } = req.params;
      const { OnboardingRequest } = require("../models");
      const request = await OnboardingRequest.findOne({ requestId });

      if (!request) {
        return sendError(res, "Onboarding request not found.", 404);
      }

      await OnboardingRequest.deleteOne({ requestId });

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const AuditService = require("../services/audit.service");

      await AuditService.log({
        schoolCode: "GLOBAL",
        actor: { userCode: req.user.userCode, email: req.user.email },
        action: "ONBOARDING_REQUEST_DELETED",
        resourceType: "ONBOARDING_REQUEST",
        resourceId: requestId,
        ipAddress,
        userAgent,
        metadata: { schoolName: request.schoolName }
      });

      return sendSuccess(res, "School application record deleted successfully.");
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/super-admin/schools/:schoolCode
   * Section 20 Destructive tenant deletion with confirmation
   */
  static async deleteSchool(req, res, next) {
    try {
      const { schoolCode } = req.params;
      const { confirmationText, reason } = req.body;
      const expected = `CONFIRM-DELETE-TENANT-${schoolCode}`;

      if (confirmationText !== expected) {
        return sendError(res, `Confirmation mismatch. Must type exactly '${expected}'`, 400);
      }
      if (!reason || reason.trim().length < 10) {
        return sendError(res, "Mandatory reason of at least 10 characters required.", 400);
      }

      const school = await School.findOne({ schoolCode });
      if (!school) {
        return sendError(res, "School tenant not found.", 404);
      }

      const { User, Student, ParentStudentLink, Class, Route, Bus, Camera } = require("../models");

      await Promise.all([
        School.deleteOne({ schoolCode }),
        User.deleteMany({ schoolCode }),
        Student.deleteMany({ schoolCode }),
        ParentStudentLink.deleteMany({ schoolCode }),
        Class.deleteMany({ schoolCode }),
        Route.deleteMany({ schoolCode }),
        Bus.deleteMany({ schoolCode }),
        Camera.deleteMany({ schoolCode })
      ]);

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const AuditService = require("../services/audit.service");

      await AuditService.log({
        schoolCode,
        actor: { userCode: req.user.userCode, email: req.user.email },
        action: "SCHOOL_TENANT_DELETED",
        resourceType: "TENANT",
        resourceId: schoolCode,
        reason,
        ipAddress,
        userAgent,
        metadata: { schoolName: school.name }
      });

      return sendSuccess(res, `Tenant ${schoolCode} and associated user accounts deleted.`);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/super-admin/schools/:schoolCode/overview
   * Full School Admin View, Usage Analytics, Details, Live GPS Fleet & End-to-End Users
   */
  static async getSchoolFullOverview(req, res, next) {
    try {
      const schoolCode = String(req.params.schoolCode || "").trim().toUpperCase();
      const school = await School.findOne({ schoolCode }).lean();
      if (!school) {
        return sendError(res, `School tenant [${schoolCode}] not found.`, 404);
      }

      const {
        User,
        Class,
        Student,
        ParentStudentLink,
        Camera,
        CctvSession,
        Bus,
        Route,
        Trip,
        Location,
        Incident,
        PanicAlert
      } = require("../models");
      const TransportService = require("../services/transport.service");

      const [
        users,
        classes,
        students,
        parentLinks,
        cameras,
        cctvSessions,
        totalCctvSessions,
        totalGpsPings,
        incidents,
        panicAlerts,
        recentActivity,
        totalAuditEvents,
        fleetOverview
      ] = await Promise.all([
        User.find({ schoolCode })
          .select("-passwordHash -twoFactor.otpCodeHash")
          .sort({ createdAt: -1 })
          .limit(300)
          .lean(),
        Class.find({ schoolCode }).sort({ grade: 1, section: 1 }).lean(),
        Student.find({ schoolCode }).sort({ createdAt: -1 }).limit(300).lean(),
        ParentStudentLink.find({ schoolCode }).lean(),
        Camera.find({ schoolCode }).sort({ createdAt: -1 }).lean(),
        CctvSession.find({ schoolCode }).sort({ startedAt: -1 }).limit(25).lean(),
        CctvSession.countDocuments({ schoolCode }),
        Location.countDocuments({ schoolCode }),
        Incident.find({ schoolCode }).sort({ createdAt: -1 }).limit(30).lean(),
        PanicAlert.find({ schoolCode }).sort({ createdAt: -1 }).limit(20).lean(),
        AuditLog.find({ schoolCode }).sort({ createdAt: -1 }).limit(40).lean(),
        AuditLog.countDocuments({ schoolCode }),
        TransportService.getLiveFleetStatus({ schoolCode, page: 1, limit: 100 })
      ]);

      // Map parent links onto students for end-to-end visibility
      const linksByStudent = new Map();
      for (const l of parentLinks) {
        if (!linksByStudent.has(l.studentCode)) linksByStudent.set(l.studentCode, []);
        linksByStudent.get(l.studentCode).push(l.parentCode);
      }
      const enrichedStudents = students.map((st) => ({
        ...st,
        linkedParents: linksByStudent.get(st.studentCode) || []
      }));

      const schoolAdmins = users.filter((u) => u.role === "SCHOOL_ADMIN");
      const activeTripsCount = (fleetOverview.fleet || []).filter((f) => f.isLive).length;
      const activeCctvSessions = cctvSessions.filter((s) => s.isActive).length;

      const usage = {
        totalUsers: users.length,
        activeUsers: users.filter((u) => u.status === "ACTIVE").length,
        pendingUsers: users.filter((u) => u.status === "PENDING").length,
        suspendedUsers: users.filter((u) => u.status === "SUSPENDED").length,
        adminsCount: schoolAdmins.length,
        teachersCount: users.filter((u) => u.role && u.role.includes("TEACHER")).length,
        parentsCount: users.filter((u) => u.role === "PARENT").length,
        driversCount: users.filter((u) => u.role === "DRIVER").length,
        transportCoordinatorsCount: users.filter((u) => u.role === "TRANSPORT_COORDINATOR").length,
        classesCount: classes.length,
        studentsCount: students.length,
        camerasCount: cameras.length,
        busesCount: (fleetOverview.fleet || []).length,
        routesCount: (fleetOverview.routes || []).length,
        activeTripsCount,
        totalCctvSessions,
        activeCctvSessions,
        totalGpsPings,
        incidentsCount: incidents.length,
        panicAlertsCount: panicAlerts.length,
        auditEventsCount: totalAuditEvents
      };

      return sendSuccess(res, `Full school overview retrieved for ${schoolCode}.`, {
        school,
        schoolAdmins,
        usage,
        users,
        classes,
        students: enrichedStudents,
        cameras,
        cctvSessions,
        fleet: fleetOverview.fleet || [],
        routes: fleetOverview.routes || [],
        incidents,
        panicAlerts,
        recentActivity
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SuperAdminController;
