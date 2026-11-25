/**
 * School Admin Controller
 * Manages user approvals, parent verification, parent-student linking,
 * account status transitions, and tenant-scoped audit trails.
 */

const SchoolAdminService = require("../services/schoolAdmin.service");
const {
  approveUserSchema,
  verifyParentSchema,
  linkStudentSchema,
  rejectUserSchema,
  userStateSchema
} = require("../validators/schoolAdmin.validator");
const { sendSuccess, sendError, sendCreated } = require("../utils/response");

class SchoolAdminController {
  /**
   * GET /api/v1/school-admin/pending-approvals
   */
  static async listPending(req, res, next) {
    try {
      const { role, page, limit } = req.query;
      const result = await SchoolAdminService.listPendingApprovals({
        schoolCode: req.tenantSchoolCode,
        role,
        page: parseInt(page || "1", 10),
        limit: parseInt(limit || "20", 10)
      });
      return sendSuccess(res, "Pending approvals retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/users/teachers/approve
   */
  static async approveTeacher(req, res, next) {
    try {
      const { error, value } = approveUserSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const teacher = await SchoolAdminService.approveTeacher({
        schoolCode: req.tenantSchoolCode,
        userId: value.userId,
        isClassTeacher: value.isClassTeacher,
        classCode: value.classCode,
        subject: value.subject,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Teacher approved successfully.", teacher);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/users/drivers/approve
   */
  static async approveDriver(req, res, next) {
    try {
      const { error, value } = approveUserSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const driver = await SchoolAdminService.approveDriver({
        schoolCode: req.tenantSchoolCode,
        userId: value.userId,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Driver approved successfully.", driver);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/users/transport-coordinators/approve
   */
  static async approveTransportCoordinator(req, res, next) {
    try {
      const { error, value } = approveUserSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const coord = await SchoolAdminService.approveTransportCoordinator({
        schoolCode: req.tenantSchoolCode,
        userId: value.userId,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Transport Coordinator approved successfully.", coord);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/users/parents/verify-and-approve
   * Full parent verification: name/mobile/email vs record, child name/class/section
   * vs student record, duplicate check, consent, code generation, VERIFIED link.
   */
  static async verifyParent(req, res, next) {
    try {
      const { error, value } = verifyParentSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await SchoolAdminService.verifyAndApproveParent({
        schoolCode: req.tenantSchoolCode,
        userId: value.userId,
        parentFullName: value.parentFullName,
        parentMobile: value.parentMobile,
        parentEmail: value.parentEmail,
        studentAdmissionNumber: value.studentAdmissionNumber,
        childFullName: value.childFullName,
        childGrade: value.childGrade,
        childSection: value.childSection,
        relationship: value.relationship,
        consentAccepted: value.consentAccepted,
        verificationNotes: value.verificationNotes,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Parent successfully verified, approved, and linked to student.", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/users/parents/link-student
   * Links an already-verified parent to an additional student with strict checks.
   */
  static async linkStudent(req, res, next) {
    try {
      const { error, value } = linkStudentSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await SchoolAdminService.linkStudentToParent({
        schoolCode: req.tenantSchoolCode,
        userId: value.userId,
        studentAdmissionNumber: value.studentAdmissionNumber,
        childFullName: value.childFullName,
        childGrade: value.childGrade,
        childSection: value.childSection,
        relationship: value.relationship,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Parent linked to additional student successfully.", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/school-admin/users/parents/:parentCode/links
   * Lists verified parent-student links for a parent (tenant-scoped).
   */
  static async listParentLinks(req, res, next) {
    try {
      const result = await SchoolAdminService.listParentLinks({
        schoolCode: req.tenantSchoolCode,
        parentCode: req.params.parentCode
      });
      return sendSuccess(res, "Parent-student links retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/users/reject
   */
  static async rejectUser(req, res, next) {
    try {
      const { error, value } = rejectUserSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const user = await SchoolAdminService.rejectUser({
        schoolCode: req.tenantSchoolCode,
        userId: value.userId,
        reason: value.reason,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "User registration request rejected.", user);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/school-admin/users/:userCode/suspend
   */
  static async suspendUser(req, res, next) {
    try {
      const { error, value } = userStateSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const user = await SchoolAdminService.suspendUser({
        schoolCode: req.tenantSchoolCode,
        userCode: req.params.userCode,
        reason: value.reason,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, `User [${req.params.userCode}] suspended.`, user);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/school-admin/users/:userCode/activate
   */
  static async activateUser(req, res, next) {
    try {
      const { error, value } = userStateSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const user = await SchoolAdminService.activateUser({
        schoolCode: req.tenantSchoolCode,
        userCode: req.params.userCode,
        reason: value.reason,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, `User [${req.params.userCode}] activated.`, user);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/school-admin/users
   * Lists all internal users for the school tenant (Teachers, Parents, Drivers, Coordinators)
   */
  static async listUsers(req, res, next) {
    try {
      const { role, status, page = 1, limit = 50 } = req.query;
      const query = { schoolCode: req.tenantSchoolCode };
      if (role) query.role = role;
      if (status) query.status = status;

      const { User, ClassTeacher } = require("../models");
      const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);
      const [rawUsers, total, classTeachers] = await Promise.all([
        User.find(query).sort({ createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
        User.countDocuments(query),
        ClassTeacher.find({ schoolCode: req.tenantSchoolCode, status: "ACTIVE" }).lean()
      ]);

      const classesByTeacher = new Map();
      for (const ct of classTeachers) {
        if (!classesByTeacher.has(ct.teacherCode)) classesByTeacher.set(ct.teacherCode, []);
        classesByTeacher.get(ct.teacherCode).push({
          classCode: ct.classCode,
          subject: ct.subject,
          isClassTeacher: ct.isClassTeacher
        });
      }

      const users = rawUsers.map((u) => ({
        ...u,
        assignedClasses: u.userCode ? (classesByTeacher.get(u.userCode) || []) : []
      }));

      return sendSuccess(res, "School users retrieved.", {
        users,
        total,
        page: parseInt(page, 10),
        totalPages: Math.ceil(total / parseInt(limit, 10))
      });
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/school-admin/users/:userCode
   * Modifies an existing user's details, class, bus, or student mappings.
   */
  static async modifyUser(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const updatedUser = await SchoolAdminService.modifyUser({
        schoolCode: req.tenantSchoolCode,
        userCode: req.params.userCode,
        fullName: req.body.fullName,
        email: req.body.email,
        phone: req.body.phone,
        status: req.body.status,
        cctvEnabled: req.body.cctvEnabled,
        transportEnabled: req.body.transportEnabled,
        studentCode: req.body.studentCode,
        classCode: req.body.classCode,
        classCodes: req.body.classCodes,
        busCode: req.body.busCode,
        routeCode: req.body.routeCode,
        isClassTeacher: req.body.isClassTeacher,
        subject: req.body.subject,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, `User [${req.params.userCode}] modified successfully.`, updatedUser);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/school-admin/daily-teacher-assignment
   */
  static async getDailyAssignments(req, res, next) {
    try {
      const { date, classCode, teacherCode } = req.query;
      const assignments = await SchoolAdminService.getDailyAssignments({
        schoolCode: req.tenantSchoolCode,
        date: date || new Date().toISOString().split("T")[0],
        classCode,
        teacherCode
      });
      return sendSuccess(res, "Daily teacher assignments retrieved.", { assignments, count: assignments.length });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/daily-teacher-assignment
   */
  static async saveDailyAssignments(req, res, next) {
    try {
      const { date, assignments } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const saved = await SchoolAdminService.saveDailyAssignments({
        schoolCode: req.tenantSchoolCode,
        date,
        assignments,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, `Synced ${saved.length} teacher assignment(s) for ${date}.`, { date, count: saved.length, assignments: saved });
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/school-admin/whatsapp
   */
  static async getWhatsAppConfig(req, res, next) {
    try {
      const config = await SchoolAdminService.getWhatsAppConfig({ schoolCode: req.tenantSchoolCode });
      return sendSuccess(res, "School WhatsApp configuration retrieved.", config);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/whatsapp/connect
   */
  static async updateWhatsAppConfig(req, res, next) {
    try {
      const { phoneNumber, businessAccountId, apiKey, status } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const updated = await SchoolAdminService.updateWhatsAppConfig({
        schoolCode: req.tenantSchoolCode,
        phoneNumber,
        businessAccountId,
        apiKey,
        status: status || "CONNECTED",
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "School WhatsApp connection updated.", updated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/whatsapp/test-connection
   */
  static async testWhatsAppConnection(req, res, next) {
    try {
      const { testPhone } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const outcome = await SchoolAdminService.testWhatsAppConnection({
        schoolCode: req.tenantSchoolCode,
        testPhone,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, outcome.message, outcome);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/school-admin/whatsapp/broadcast
   */
  static async sendWhatsAppBroadcast(req, res, next) {
    try {
      const { target, classCode, title, message } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const outcome = await SchoolAdminService.sendWhatsAppBroadcast({
        schoolCode: req.tenantSchoolCode,
        target,
        classCode,
        title,
        message,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, `Broadcast sent to ${outcome.dispatched} recipient(s).`, outcome);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = SchoolAdminController;
