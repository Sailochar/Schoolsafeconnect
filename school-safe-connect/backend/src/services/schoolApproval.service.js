/**
 * School Onboarding and Approval Workflow Engine
 * Governs school registration, Super Admin approval with mandatory justification,
 * atomic identity code generation, tenant initialization, and School Admin provisioning.
 */

const { v4: uuidv4 } = require("uuid");
const { OnboardingRequest, School, User, AcademicYear } = require("../models");
const IdGeneratorService = require("./idGenerator.service");
const AuditService = require("./audit.service");
const { hashPassword } = require("../utils/password");
const { SCHOOL_STATUS, USER_STATUS, ROLES } = require("../config/constants");
const logger = require("../utils/logger");

class SchoolApprovalService {
  /**
   * Public submission of a school onboarding registration request
   */
  static async submitOnboardingRequest({ data, ipAddress, userAgent }) {
    const requestId = `REQ-${Date.now()}-${uuidv4().substring(0, 6).toUpperCase()}`;

    const newRequest = new OnboardingRequest({
      requestId,
      schoolName: data.schoolName,
      board: data.board,
      address: data.address,
      contactPerson: data.contactPerson,
      expectedStudents: data.expectedStudents,
      proposedAdminDetails: {
        fullName: data.proposedAdminDetails.fullName,
        email: data.proposedAdminDetails.email,
        phone: data.proposedAdminDetails.phone,
        desiredPassword: data.proposedAdminDetails.password || null
      },
      documents: data.documents || [],
      status: SCHOOL_STATUS.PENDING,
      ipAddress,
      userAgent
    });

    await newRequest.save();

    await AuditService.log({
      schoolCode: "GLOBAL",
      actor: { userCode: "PUBLIC_APPLICANT", role: "ANONYMOUS" },
      action: "SCHOOL_ONBOARDING_REQUESTED",
      resourceType: "ONBOARDING_REQUEST",
      resourceId: requestId,
      reason: "New school onboarding submission",
      ipAddress,
      userAgent,
      metadata: { schoolName: data.schoolName, board: data.board }
    });

    return newRequest;
  }

  /**
   * Super Admin lists onboarding requests
   */
  static async getOnboardingRequests({ status, page = 1, limit = 20 }) {
    const query = {};
    if (status) {query.status = status;}

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      OnboardingRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit),
      OnboardingRequest.countDocuments(query)
    ]);

    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Super Admin approves school onboarding request
   * Requires mandatory reason. Generates SSC-SCH-XXXX and initializes tenant.
   */
  static async approveSchoolRequest({ requestId, reason, superAdmin, ipAddress, userAgent }) {
    if (!reason || reason.trim().length < 10) {
      const err = new Error("A mandatory approval reason (minimum 10 characters) is required.");
      err.statusCode = 400;
      throw err;
    }

    const request = await OnboardingRequest.findOne({ requestId, status: SCHOOL_STATUS.PENDING }).select("+proposedAdminDetails.desiredPassword");
    if (!request) {
      const err = new Error("Pending onboarding request not found.");
      err.statusCode = 404;
      throw err;
    }

    // 1. Generate unique hierarchical schoolCode: SSC-SCH-XXXX
    const schoolCode = await IdGeneratorService.generateSchoolCode();

    // 2. Create School Tenant record
    const school = new School({
      schoolCode,
      name: request.schoolName,
      board: request.board,
      address: request.address,
      contactPerson: request.contactPerson,
      status: SCHOOL_STATUS.ACTIVE,
      approvalDetails: {
        approvedBy: superAdmin.userCode,
        approvedAt: new Date(),
        reason
      },
      settings: {
        cctvGlobalEnabled: true,
        transportGlobalEnabled: true,
        defaultDelayedVisibilitySeconds: 30,
        timezone: "Asia/Kolkata"
      }
    });

    await school.save();

    // 3. Generate hierarchical School Admin userCode: SSC-SCH-XXXX-ADM-001
    const adminUserCode = await IdGeneratorService.generateUserCode(schoolCode, ROLES.SCHOOL_ADMIN);

    // Initial password: use desiredPassword chosen at signup or fallback to PilotSecure2026!
    const effectivePassword = request.proposedAdminDetails?.desiredPassword || "PilotSecure2026!";
    const passwordHash = await hashPassword(effectivePassword);

    // 4. Create School Admin user
    const adminUser = new User({
      schoolCode,
      userCode: adminUserCode,
      role: ROLES.SCHOOL_ADMIN,
      fullName: request.proposedAdminDetails.fullName,
      email: request.proposedAdminDetails.email,
      phone: request.proposedAdminDetails.phone,
      passwordHash,
      status: USER_STATUS.ACTIVE,
      twoFactor: {
        method: "SMS",
        isVerified: true
      },
      verificationDetails: {
        status: "VERIFIED",
        verifiedBy: superAdmin.userCode,
        verifiedAt: new Date(),
        verificationNotes: "Auto-verified on initial school tenant creation"
      }
    });

    await adminUser.save();

    // 5. Initialize current Academic Year (e.g. 2026-2027)
    const currentYear = new AcademicYear({
      schoolCode,
      academicYearCode: "2026-2027",
      yearName: "Academic Year 2026-2027",
      startDate: new Date("2026-04-01"),
      endDate: new Date("2027-03-31"),
      isCurrent: true,
      isArchived: false
    });
    await currentYear.save();

    // 6. Update Onboarding Request
    request.status = SCHOOL_STATUS.APPROVED;
    request.approvalReason = reason;
    request.allocatedSchoolCode = schoolCode;
    request.allocatedAdminCode = adminUserCode;
    request.reviewDetails = {
      reviewedBy: superAdmin.userCode,
      reviewedAt: new Date()
    };
    await request.save();

    // 7. Write permanent audit log
    await AuditService.log({
      schoolCode,
      actor: {
        userCode: superAdmin.userCode,
        role: superAdmin.role,
        fullName: superAdmin.fullName,
        email: superAdmin.email
      },
      action: "SCHOOL_APPROVED",
      resourceType: "SCHOOL",
      resourceId: schoolCode,
      reason,
      ipAddress,
      userAgent,
      metadata: {
        requestId,
        allocatedAdminCode: adminUserCode,
        schoolName: school.name
      }
    });

    logger.info(`School approved: ${schoolCode} (${school.name}) by Super Admin ${superAdmin.userCode}`);

    return {
      school,
      adminUser: {
        userCode: adminUser.userCode,
        fullName: adminUser.fullName,
        email: adminUser.email,
        phone: adminUser.phone,
        role: adminUser.role,
        schoolCode: adminUser.schoolCode
      },
      passwordNote: request.proposedAdminDetails?.desiredPassword
        ? "User-created password set at signup"
        : "Default temporary password assigned",
      temporaryPassword: request.proposedAdminDetails?.desiredPassword ? undefined : effectivePassword
    };
  }

  /**
   * Super Admin rejects school onboarding request
   * Requires mandatory reason.
   */
  static async rejectSchoolRequest({ requestId, reason, superAdmin, ipAddress, userAgent }) {
    if (!reason || reason.trim().length < 10) {
      const err = new Error("A mandatory rejection reason (minimum 10 characters) is required.");
      err.statusCode = 400;
      throw err;
    }

    const request = await OnboardingRequest.findOne({ requestId, status: SCHOOL_STATUS.PENDING });
    if (!request) {
      const err = new Error("Pending onboarding request not found.");
      err.statusCode = 404;
      throw err;
    }

    request.status = SCHOOL_STATUS.REJECTED;
    request.rejectionReason = reason;
    request.reviewDetails = {
      reviewedBy: superAdmin.userCode,
      reviewedAt: new Date()
    };
    await request.save();

    await AuditService.log({
      schoolCode: "GLOBAL",
      actor: {
        userCode: superAdmin.userCode,
        role: superAdmin.role,
        fullName: superAdmin.fullName,
        email: superAdmin.email
      },
      action: "SCHOOL_REJECTED",
      resourceType: "ONBOARDING_REQUEST",
      resourceId: requestId,
      reason,
      ipAddress,
      userAgent,
      metadata: { schoolName: request.schoolName }
    });

    return request;
  }

  /**
   * Super Admin suspends a school tenant
   */
  static async suspendSchoolTenant({ schoolCode, reason, superAdmin, ipAddress, userAgent }) {
    if (!reason || reason.trim().length < 10) {
      const err = new Error("A mandatory reason is required to suspend a school tenant.");
      err.statusCode = 400;
      throw err;
    }

    const school = await School.findOne({ schoolCode });
    if (!school) {
      const err = new Error("School not found.");
      err.statusCode = 404;
      throw err;
    }

    school.status = SCHOOL_STATUS.SUSPENDED;
    school.suspensionDetails = {
      suspendedBy: superAdmin.userCode,
      suspendedAt: new Date(),
      reason
    };
    await school.save();

    // Also suspend users under this tenant
    await User.updateMany({ schoolCode }, { status: USER_STATUS.SUSPENDED });

    await AuditService.log({
      schoolCode,
      actor: {
        userCode: superAdmin.userCode,
        role: superAdmin.role,
        fullName: superAdmin.fullName,
        email: superAdmin.email
      },
      action: "SCHOOL_TENANT_SUSPENDED",
      resourceType: "SCHOOL",
      resourceId: schoolCode,
      reason,
      ipAddress,
      userAgent
    });

    return school;
  }

  /**
   * Super Admin reactivates a suspended school tenant
   */
  static async activateSchoolTenant({ schoolCode, reason, superAdmin, ipAddress, userAgent }) {
    if (!reason || reason.trim().length < 10) {
      const err = new Error("A mandatory reason is required to activate a school tenant.");
      err.statusCode = 400;
      throw err;
    }

    const school = await School.findOne({ schoolCode });
    if (!school) {
      const err = new Error("School not found.");
      err.statusCode = 404;
      throw err;
    }

    school.status = SCHOOL_STATUS.ACTIVE;
    await school.save();

    await User.updateMany({ schoolCode, role: ROLES.SCHOOL_ADMIN }, { status: USER_STATUS.ACTIVE });

    await AuditService.log({
      schoolCode,
      actor: {
        userCode: superAdmin.userCode,
        role: superAdmin.role,
        fullName: superAdmin.fullName,
        email: superAdmin.email
      },
      action: "SCHOOL_TENANT_ACTIVATED",
      resourceType: "SCHOOL",
      resourceId: schoolCode,
      reason,
      ipAddress,
      userAgent
    });

    return school;
  }

  /**
   * Section 20: School Admin Removal (Two-step destructive action)
   * Super Admin removes a School Admin. Requires high-risk confirmation.
   */
  static async removeSchoolAdmin({ schoolCode, adminUserCode, confirmationText, reason, superAdmin, ipAddress, userAgent }) {
    const expectedConfirmation = `CONFIRM-REMOVE-ADMIN-${adminUserCode}`;
    if (confirmationText !== expectedConfirmation) {
      const err = new Error(`High-risk confirmation string mismatch. Must exactly match: '${expectedConfirmation}'`);
      err.statusCode = 400;
      throw err;
    }

    if (!reason || reason.trim().length < 10) {
      const err = new Error("Mandatory justification reason required for School Admin removal.");
      err.statusCode = 400;
      throw err;
    }

    const admin = await User.findOne({ schoolCode, userCode: adminUserCode, role: ROLES.SCHOOL_ADMIN });
    if (!admin) {
      const err = new Error("School Admin user not found.");
      err.statusCode = 404;
      throw err;
    }

    // Mark as suspended / revoked rather than deleting tenant
    admin.status = USER_STATUS.SUSPENDED;
    await admin.save();

    await AuditService.log({
      schoolCode,
      actor: {
        userCode: superAdmin.userCode,
        role: superAdmin.role,
        fullName: superAdmin.fullName,
        email: superAdmin.email
      },
      action: "SCHOOL_ADMIN_REMOVED",
      resourceType: "USER",
      resourceId: adminUserCode,
      reason,
      ipAddress,
      userAgent,
      metadata: { adminFullName: admin.fullName, adminEmail: admin.email }
    });

    return { success: true, message: `School Admin ${adminUserCode} has been removed/suspended.` };
  }
}

module.exports = SchoolApprovalService;
