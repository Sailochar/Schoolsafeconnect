/**
 * School Admin Management Service
 * Enforces internal user approvals, multi-step parent verification,
 * duplicate account checks, parent-child-class mapping, and immutable
 * hierarchical identity code generation.
 *
 * Security posture:
 * - schoolCode is always taken from the authenticated tenant context (req.tenantSchoolCode),
 *   never from the request body/params/query.
 * - Identity codes are generated only after approval, via an atomic counter,
 *   and every code-generation event is audit-logged with full actor context.
 * - Codes are never regenerated for an already-approved account (idempotency).
 */

const { User, Student, ParentStudentLink } = require("../models");
const IdGeneratorService = require("./idGenerator.service");
const AuditService = require("./audit.service");
const { ROLES, USER_STATUS, PARENT_VERIFICATION_STATUS, STUDENT_STATUS } = require("../config/constants");
const logger = require("../utils/logger");

class SchoolAdminService {
  /**
   * Builds the standard actor block used across all audit entries.
   */
  static _actor(adminUser) {
    return {
      userCode: adminUser.userCode,
      role: adminUser.role,
      fullName: adminUser.fullName,
      email: adminUser.email
    };
  }

  /**
   * Generates a hierarchical user code only after approval and audit-logs the
   * code-generation event. Codes are atomically allocated (never reused).
   */
  static async _generateAndAuditCode({ schoolCode, role, adminUser, ipAddress, userAgent, metadata = {} }) {
    const userCode = await IdGeneratorService.generateUserCode(schoolCode, role);

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "USER_CODE_GENERATED",
      resourceType: "USER_CODE",
      resourceId: userCode,
      reason: `Hierarchical identity code generated for role [${role}] upon School Admin approval`,
      ipAddress,
      userAgent,
      metadata: { role, generatedCode: userCode, ...metadata }
    });

    logger.info(`[IDENTITY] Code generated: ${userCode} for role ${role} in school ${schoolCode}`);
    return userCode;
  }

  /**
   * Normalizes a name for case-insensitive, whitespace-insensitive comparison.
   */
  static _normalizeName(value) {
    return String(value || "").trim().toLowerCase();
  }

  /**
   * Lists all pending approvals scoped by the tenant schoolCode
   */
  static async listPendingApprovals({ schoolCode, role, page = 1, limit = 20 }) {
    const query = { schoolCode, status: USER_STATUS.PENDING };
    if (role) { query.role = role; }

    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      User.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).select("-passwordHash"),
      User.countDocuments(query)
    ]);

    return { users, total, page, totalPages: Math.ceil(total / limit) };
  }

  /**
   * Approves a Teacher account (CLASS_TEACHER or SUBJECT_TEACHER).
   * Identity code is generated only after all validation passes.
   * isClassTeacher is validated for consistency but class assignment belongs
   * to the class module; no ClassTeacher record is created here.
   */
  static async approveTeacher({ schoolCode, userId, isClassTeacher = false, classCode, subject, adminUser, ipAddress, userAgent }) {
    const user = await User.findOne({ _id: userId, schoolCode });
    if (!user) {
      const err = new Error("Teacher account not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.role !== ROLES.CLASS_TEACHER && user.role !== ROLES.SUBJECT_TEACHER) {
      const err = new Error("User is not registered as a teacher.");
      err.statusCode = 400;
      throw err;
    }

    // Idempotency / state guard
    if (user.status !== USER_STATUS.PENDING) {
      if (user.status === USER_STATUS.ACTIVE) {
        const err = new Error("Teacher is already approved and active.");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(`Teacher account is in [${user.status}] state and cannot be approved.`);
      err.statusCode = 409;
      throw err;
    }

    // isClassTeacher consistency: only a CLASS_TEACHER may be designated as class teacher.
    // Class assignment itself is owned by the class module and is not created here.
    if (isClassTeacher === true && user.role !== ROLES.CLASS_TEACHER) {
      const err = new Error("isClassTeacher can only be set for a CLASS_TEACHER role.");
      err.statusCode = 400;
      throw err;
    }

    // Generate hierarchical teacher code only after approval decision
    const userCode = await SchoolAdminService._generateAndAuditCode({
      schoolCode,
      role: ROLES.CLASS_TEACHER,
      adminUser,
      ipAddress,
      userAgent,
      metadata: { teacherFullName: user.fullName, teacherEmail: user.email, isClassTeacher: Boolean(isClassTeacher) }
    });

    user.userCode = userCode;
    user.status = USER_STATUS.ACTIVE;
    user.twoFactor.isVerified = true;
    user.verificationDetails = {
      status: PARENT_VERIFICATION_STATUS.VERIFIED,
      verifiedBy: adminUser.userCode,
      verifiedAt: new Date(),
      verificationNotes: "Teacher credentials verified by School Admin"
    };

    await user.save();

    if (classCode) {
      const ClassStudentService = require("./classStudent.service");
      await ClassStudentService.assignTeacherToClass({
        schoolCode,
        classCode,
        teacherCode: userCode,
        isClassTeacher: Boolean(isClassTeacher),
        subject: subject || "General",
        adminUser,
        ipAddress,
        userAgent
      });
    }

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "TEACHER_APPROVED",
      resourceType: "USER",
      resourceId: userCode,
      reason: "School Admin verified teacher credentials",
      ipAddress,
      userAgent,
      metadata: { teacherFullName: user.fullName, teacherEmail: user.email, role: user.role, isClassTeacher: Boolean(isClassTeacher) }
    });

    return user;
  }

  /**
   * Approves a Driver account.
   */
  static async approveDriver({ schoolCode, userId, adminUser, ipAddress, userAgent }) {
    const user = await User.findOne({ _id: userId, schoolCode });
    if (!user) {
      const err = new Error("Driver account not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.role !== ROLES.DRIVER) {
      const err = new Error("User is not registered as a driver.");
      err.statusCode = 400;
      throw err;
    }

    if (user.status !== USER_STATUS.PENDING) {
      if (user.status === USER_STATUS.ACTIVE) {
        const err = new Error("Driver is already approved and active.");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(`Driver account is in [${user.status}] state and cannot be approved.`);
      err.statusCode = 409;
      throw err;
    }

    const userCode = await SchoolAdminService._generateAndAuditCode({
      schoolCode,
      role: ROLES.DRIVER,
      adminUser,
      ipAddress,
      userAgent,
      metadata: { driverFullName: user.fullName, phone: user.phone }
    });

    user.userCode = userCode;
    user.status = USER_STATUS.ACTIVE;
    user.twoFactor.isVerified = true;
    user.verificationDetails = {
      status: PARENT_VERIFICATION_STATUS.VERIFIED,
      verifiedBy: adminUser.userCode,
      verifiedAt: new Date(),
      verificationNotes: "Driver credentials verified by School Admin"
    };

    await user.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "DRIVER_APPROVED",
      resourceType: "USER",
      resourceId: userCode,
      reason: "Driver registration approved by School Admin",
      ipAddress,
      userAgent,
      metadata: { driverFullName: user.fullName, phone: user.phone }
    });

    return user;
  }

  /**
   * Approves a Transport Coordinator account.
   */
  static async approveTransportCoordinator({ schoolCode, userId, adminUser, ipAddress, userAgent }) {
    const user = await User.findOne({ _id: userId, schoolCode });
    if (!user) {
      const err = new Error("Transport Coordinator account not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.role !== ROLES.TRANSPORT_COORDINATOR) {
      const err = new Error("User is not registered as a transport coordinator.");
      err.statusCode = 400;
      throw err;
    }

    if (user.status !== USER_STATUS.PENDING) {
      if (user.status === USER_STATUS.ACTIVE) {
        const err = new Error("Transport Coordinator is already approved and active.");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(`Transport Coordinator account is in [${user.status}] state and cannot be approved.`);
      err.statusCode = 409;
      throw err;
    }

    const userCode = await SchoolAdminService._generateAndAuditCode({
      schoolCode,
      role: ROLES.TRANSPORT_COORDINATOR,
      adminUser,
      ipAddress,
      userAgent,
      metadata: { coordinatorFullName: user.fullName, email: user.email }
    });

    user.userCode = userCode;
    user.status = USER_STATUS.ACTIVE;
    user.twoFactor.isVerified = true;
    user.verificationDetails = {
      status: PARENT_VERIFICATION_STATUS.VERIFIED,
      verifiedBy: adminUser.userCode,
      verifiedAt: new Date(),
      verificationNotes: "Transport Coordinator credentials verified by School Admin"
    };

    await user.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "TRANSPORT_COORDINATOR_APPROVED",
      resourceType: "USER",
      resourceId: userCode,
      reason: "Transport Coordinator approved by School Admin",
      ipAddress,
      userAgent
    });

    return user;
  }

  /**
   * Section: Parent Verification Workflow
   * Verifies:
   *   - Parent full name, mobile, email against the enrolled user record
   *   - Student admission number, child full name, class grade & section
   *   - Relationship to child
   *   - Duplicate account check (phone/email not already verified for this student)
   *   - Consent acceptance (mandatory)
   *   - Generates SSC-SCH-XXXX-PAR-XXX only after approval
   *   - Sets parent status to ACTIVE and verificationDetails to VERIFIED
   *   - Creates/updates a VERIFIED ParentStudentLink
   */
  static async verifyAndApproveParent({
    schoolCode,
    userId,
    parentFullName,
    parentMobile,
    parentEmail,
    studentAdmissionNumber,
    childFullName,
    childGrade,
    childSection,
    relationship,
    consentAccepted,
    verificationNotes,
    adminUser,
    ipAddress,
    userAgent
  }) {
    if (consentAccepted !== true) {
      const err = new Error("Parental consent acceptance is mandatory before approval.");
      err.statusCode = 400;
      throw err;
    }

    // 1. Load the parent applicant, tenant-locked
    const parent = await User.findOne({ _id: userId, schoolCode, role: ROLES.PARENT });
    if (!parent) {
      const err = new Error("Parent applicant not found.");
      err.statusCode = 404;
      throw err;
    }

    // Idempotency / state guard
    if (parent.status !== USER_STATUS.PENDING) {
      if (parent.status === USER_STATUS.ACTIVE) {
        const err = new Error("Parent is already verified and active.");
        err.statusCode = 409;
        throw err;
      }
      const err = new Error(`Parent account is in [${parent.status}] state and cannot be verified.`);
      err.statusCode = 409;
      throw err;
    }

    // 2. Verify parent identity details against the enrolled record (never trust frontend)
    if (SchoolAdminService._normalizeName(parentFullName) !== SchoolAdminService._normalizeName(parent.fullName)) {
      const err = new Error("Parent full name does not match the registered account.");
      err.statusCode = 400;
      throw err;
    }
    if (String(parentMobile || "").trim() !== String(parent.phone || "").trim()) {
      const err = new Error("Parent mobile number does not match the registered account.");
      err.statusCode = 400;
      throw err;
    }
    if (String(parentEmail || "").trim().toLowerCase() !== String(parent.email || "").trim().toLowerCase()) {
      const err = new Error("Parent email does not match the registered account.");
      err.statusCode = 400;
      throw err;
    }

    // 3. Validate student exists in the same school tenant and is active
    const student = await Student.findOne({ schoolCode, admissionNumber: studentAdmissionNumber });
    if (!student) {
      const err = new Error(`Student with admission number [${studentAdmissionNumber}] does not exist in school tenant [${schoolCode}].`);
      err.statusCode = 404;
      throw err;
    }
    if (student.status !== STUDENT_STATUS.ACTIVE) {
      const err = new Error(`Student [${student.fullName}] is not in an active state.`);
      err.statusCode = 400;
      throw err;
    }

    // 4. Verify child full name, class grade and section against the student record
    if (SchoolAdminService._normalizeName(childFullName) !== SchoolAdminService._normalizeName(student.fullName)) {
      const err = new Error("Child full name does not match the student record.");
      err.statusCode = 400;
      throw err;
    }

    const expectedClassCode = IdGeneratorService.formatClassCode(schoolCode, childGrade, childSection);
    if (student.classCode !== expectedClassCode) {
      const err = new Error("Class/section does not match the student record.");
      err.statusCode = 400;
      throw err;
    }
    if (String(student.section || "").trim().toUpperCase() !== String(childSection || "").trim().toUpperCase()) {
      const err = new Error("Child section does not match the student record.");
      err.statusCode = 400;
      throw err;
    }

    // 5. Unique Student Mapping Guard: If student is already mapped to another parent, reject mapping
    const existingVerifiedLinks = await ParentStudentLink.find({
      schoolCode,
      studentCode: student.studentCode,
      status: PARENT_VERIFICATION_STATUS.VERIFIED
    });

    for (const link of existingVerifiedLinks) {
      if (parent.userCode && link.parentCode === parent.userCode) {
        continue;
      }
      if (link.parentUserId && link.parentUserId.toString() === parent._id.toString()) {
        continue;
      }
      const err = new Error(`Student [${student.fullName}] (Adm No: ${student.admissionNumber}) is already mapped to another parent account [${link.parentCode}]. Each student can only be mapped to one parent account.`);
      err.statusCode = 409;
      throw err;
    }

    // 6. Generate hierarchical Parent code only after approval (atomic counter, never reused)
    let parentUserCode = parent.userCode;
    let codeGenerated = false;
    if (!parentUserCode || parentUserCode.startsWith("TEMP")) {
      parentUserCode = await SchoolAdminService._generateAndAuditCode({
        schoolCode,
        role: ROLES.PARENT,
        adminUser,
        ipAddress,
        userAgent,
        metadata: { parentFullName: parent.fullName, parentEmail: parent.email, phone: parent.phone }
      });
      parent.userCode = parentUserCode;
      codeGenerated = true;
    }

    // 7. Update Parent User Document
    parent.status = USER_STATUS.ACTIVE;
    parent.twoFactor.isVerified = true;
    parent.verificationDetails = {
      status: PARENT_VERIFICATION_STATUS.VERIFIED,
      verifiedBy: adminUser.userCode,
      verifiedAt: new Date(),
      verificationNotes: verificationNotes || "Parent custody verified against student admission registry",
      consentAccepted: true,
      consentAcceptedAt: new Date()
    };

    await parent.save();

    // 8. Create or Update Verified ParentStudentLink
    const isFirstVerifiedParent = existingVerifiedLinks.length === 0;
    const link = await ParentStudentLink.findOneAndUpdate(
      { schoolCode, parentCode: parentUserCode, studentCode: student.studentCode },
      {
        $set: {
          relationship,
          isPrimaryContact: isFirstVerifiedParent,
          status: PARENT_VERIFICATION_STATUS.VERIFIED,
          verifiedBy: adminUser.userCode,
          verifiedAt: new Date()
        },
        $unset: { rejectionReason: "" }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // 9. Permanent audit log for the approval
    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "PARENT_VERIFIED_AND_APPROVED",
      resourceType: "USER",
      resourceId: parentUserCode,
      reason: "School Admin verified parent-child custody and enrollment status",
      ipAddress,
      userAgent,
      metadata: {
        studentCode: student.studentCode,
        studentAdmissionNumber,
        studentClass: student.classCode,
        studentSection: student.section,
        relationship: link.relationship,
        parentFullName: parent.fullName,
        parentEmail: parent.email,
        codeGenerated,
        isPrimaryContact: link.isPrimaryContact
      }
    });

    return { parent, student, link, parentUserCode, codeGenerated };
  }

  /**
   * Links an additional (already verified) parent to a specified student.
   * Strict checks: parent must be ACTIVE + VERIFIED, student must exist in tenant,
   * child name/grade/section must match the student record, no duplicate verified link.
   */
  static async linkStudentToParent({
    schoolCode,
    userId,
    studentAdmissionNumber,
    childFullName,
    childGrade,
    childSection,
    relationship,
    adminUser,
    ipAddress,
    userAgent
  }) {
    const parent = await User.findOne({ _id: userId, schoolCode, role: ROLES.PARENT });
    if (!parent) {
      const err = new Error("Parent account not found.");
      err.statusCode = 404;
      throw err;
    }

    if (parent.status !== USER_STATUS.ACTIVE || parent.verificationDetails?.status !== PARENT_VERIFICATION_STATUS.VERIFIED) {
      const err = new Error("Parent must be verified and active before linking additional students.");
      err.statusCode = 400;
      throw err;
    }

    if (!parent.userCode) {
      const err = new Error("Parent account has no identity code and cannot be linked.");
      err.statusCode = 400;
      throw err;
    }

    const student = await Student.findOne({ schoolCode, admissionNumber: studentAdmissionNumber });
    if (!student) {
      const err = new Error(`Student with admission number [${studentAdmissionNumber}] does not exist in school tenant [${schoolCode}].`);
      err.statusCode = 404;
      throw err;
    }
    if (student.status !== STUDENT_STATUS.ACTIVE) {
      const err = new Error(`Student [${student.fullName}] is not in an active state.`);
      err.statusCode = 400;
      throw err;
    }

    if (SchoolAdminService._normalizeName(childFullName) !== SchoolAdminService._normalizeName(student.fullName)) {
      const err = new Error("Child full name does not match the student record.");
      err.statusCode = 400;
      throw err;
    }

    const expectedClassCode = IdGeneratorService.formatClassCode(schoolCode, childGrade, childSection);
    if (student.classCode !== expectedClassCode) {
      const err = new Error("Class/section does not match the student record.");
      err.statusCode = 400;
      throw err;
    }

    const existingLink = await ParentStudentLink.findOne({
      schoolCode,
      parentCode: parent.userCode,
      studentCode: student.studentCode
    });

    if (existingLink && existingLink.status === PARENT_VERIFICATION_STATUS.VERIFIED) {
      const err = new Error("Parent is already verified-linked to this student.");
      err.statusCode = 409;
      throw err;
    }

    const isFirstVerifiedLink = !(await ParentStudentLink.findOne({
      schoolCode,
      studentCode: student.studentCode,
      status: PARENT_VERIFICATION_STATUS.VERIFIED
    }));

    const link = await ParentStudentLink.findOneAndUpdate(
      { schoolCode, parentCode: parent.userCode, studentCode: student.studentCode },
      {
        $set: {
          relationship,
          isPrimaryContact: isFirstVerifiedLink,
          status: PARENT_VERIFICATION_STATUS.VERIFIED,
          verifiedBy: adminUser.userCode,
          verifiedAt: new Date()
        },
        $unset: { rejectionReason: "" }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "PARENT_STUDENT_LINKED",
      resourceType: "PARENT_STUDENT_LINK",
      resourceId: link._id,
      reason: "School Admin linked verified parent to additional student",
      ipAddress,
      userAgent,
      metadata: {
        parentCode: parent.userCode,
        studentCode: student.studentCode,
        studentAdmissionNumber,
        relationship: link.relationship,
        isPrimaryContact: link.isPrimaryContact
      }
    });

    return { parent, student, link };
  }

  /**
   * Rejects an internal user applicant. Records reason and rejects any
   * associated verified parent-student links where applicable.
   */
  static async rejectUser({ schoolCode, userId, reason, adminUser, ipAddress, userAgent }) {
    if (!reason || reason.trim().length < 5) {
      const err = new Error("Rejection reason is mandatory.");
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ _id: userId, schoolCode });
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.status === USER_STATUS.REJECTED) {
      const err = new Error("User is already rejected.");
      err.statusCode = 409;
      throw err;
    }
    if (user.status === USER_STATUS.ACTIVE) {
      const err = new Error("Cannot reject an active account; use suspend instead.");
      err.statusCode = 409;
      throw err;
    }

    user.status = USER_STATUS.REJECTED;
    if (user.role === ROLES.PARENT) {
      user.verificationDetails = {
        ...user.verificationDetails,
        status: PARENT_VERIFICATION_STATUS.REJECTED,
        verificationNotes: reason
      };
    }

    await user.save();

    // Reject any parent-student links tied to this parent account
    if (user.userCode) {
      await ParentStudentLink.updateMany(
        {
          schoolCode,
          parentCode: user.userCode,
          status: { $ne: PARENT_VERIFICATION_STATUS.REJECTED }
        },
        {
          $set: { status: PARENT_VERIFICATION_STATUS.REJECTED, rejectionReason: reason }
        }
      );
    }

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "USER_REJECTED",
      resourceType: "USER",
      resourceId: user.userCode || String(user._id),
      reason,
      ipAddress,
      userAgent,
      metadata: { role: user.role, email: user.email, userCode: user.userCode }
    });

    return user;
  }

  /**
   * Suspends an active internal user (PENDING -> not allowed; only ACTIVE).
   */
  static async suspendUser({ schoolCode, userCode, reason, adminUser, ipAddress, userAgent }) {
    if (!reason || reason.trim().length < 5) {
      const err = new Error("Suspension reason is mandatory.");
      err.statusCode = 400;
      throw err;
    }

    const user = await User.findOne({ schoolCode, userCode });
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.status !== USER_STATUS.ACTIVE) {
      const err = new Error(`Only active users can be suspended. Current status: [${user.status}].`);
      err.statusCode = 409;
      throw err;
    }

    user.status = USER_STATUS.SUSPENDED;
    await user.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "USER_SUSPENDED",
      resourceType: "USER",
      resourceId: userCode,
      reason,
      ipAddress,
      userAgent,
      metadata: { role: user.role, email: user.email }
    });

    return user;
  }

  /**
   * Activates a suspended internal user (only SUSPENDED -> ACTIVE).
   */
  static async activateUser({ schoolCode, userCode, reason, adminUser, ipAddress, userAgent }) {
    const user = await User.findOne({ schoolCode, userCode });
    if (!user) {
      const err = new Error("User not found.");
      err.statusCode = 404;
      throw err;
    }

    if (user.status !== USER_STATUS.SUSPENDED) {
      const err = new Error(`Only suspended users can be activated. Current status: [${user.status}].`);
      err.statusCode = 409;
      throw err;
    }

    user.status = USER_STATUS.ACTIVE;
    await user.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "USER_ACTIVATED",
      resourceType: "USER",
      resourceId: userCode,
      reason: reason || "Re-activated by School Admin",
      ipAddress,
      userAgent,
      metadata: { role: user.role, email: user.email }
    });

    return user;
  }

  /**
   * Lists verified parent-student links for a parent (tenant-scoped).
   */
  static async listParentLinks({ schoolCode, parentCode }) {
    const links = await ParentStudentLink.find({ schoolCode, parentCode }).sort({ createdAt: -1 }).lean();
    return { links };
  }

  /**
   * Modifies an existing user's profile, status (active/deactivated), assigned class,
   * bus location permissions, or student mappings.
   */
  static async modifyUser({
    schoolCode,
    userCode,
    fullName,
    email,
    phone,
    status,
    cctvEnabled,
    transportEnabled,
    studentCode,
    classCode,
    classCodes,
    busCode,
    routeCode,
    isClassTeacher,
    subject,
    adminUser,
    ipAddress,
    userAgent
  }) {
    const user = await User.findOne({ schoolCode, userCode });
    if (!user) {
      const err = new Error(`User with code [${userCode}] not found.`);
      err.statusCode = 404;
      throw err;
    }

    if (fullName) { user.fullName = fullName.trim(); }
    if (email) { user.email = email.trim().toLowerCase(); }
    if (phone) { user.phone = phone.trim(); }

    // Status: Activate or Deactivate
    if (status) {
      user.status = status;
      if (status === USER_STATUS.ACTIVE && user.role === ROLES.PARENT) {
        user.verificationDetails = user.verificationDetails || {};
        user.verificationDetails.status = PARENT_VERIFICATION_STATUS.VERIFIED;
      }
    }

    // Access Controls for CCTV and Bus Location
    user.accessControls = user.accessControls || {};
    if (cctvEnabled !== undefined) {
      user.accessControls.cctvEnabled = Boolean(cctvEnabled);
    }
    if (transportEnabled !== undefined) {
      user.accessControls.transportEnabled = Boolean(transportEnabled);
    }
    if (classCode) {
      user.accessControls.cctvClassCode = classCode;
    }
    if (busCode) {
      user.accessControls.transportBusCode = busCode;
    }

    // 1. Parent modifications (change student, class, bus no)
    if (user.role === ROLES.PARENT) {
      const existingLink = await ParentStudentLink.findOne({ schoolCode, parentCode: user.userCode });
      let targetStudentCode = studentCode || existingLink?.studentCode;

      // Only check duplicate mapping if a different studentCode is being explicitly assigned
      if (studentCode && (!existingLink || existingLink.studentCode !== studentCode)) {
        const duplicateLink = await ParentStudentLink.findOne({
          schoolCode,
          studentCode,
          parentCode: { $ne: user.userCode },
          status: PARENT_VERIFICATION_STATUS.VERIFIED
        });
        if (duplicateLink) {
          const err = new Error(`Student is already mapped to parent [${duplicateLink.parentCode}]. Each student can strictly only belong to one verified parent account.`);
          err.statusCode = 409;
          throw err;
        }
      }

      if (targetStudentCode) {
        const student = await Student.findOne({ schoolCode, studentCode: targetStudentCode });
        if (student) {
          await ParentStudentLink.findOneAndUpdate(
            { schoolCode, parentCode: user.userCode, studentCode: targetStudentCode },
            {
              $set: {
                parentUserId: user._id,
                relationship: user.verificationDetails?.submittedRelationship || "PARENT",
                status: PARENT_VERIFICATION_STATUS.VERIFIED,
                verifiedBy: adminUser.userCode,
                verifiedAt: new Date()
              }
            },
            { upsert: true, new: true }
          );

          if (classCode) {
            student.classCode = classCode;
            const match = classCode.match(/CLS-([A-Z0-9]+)-?([A-Z0-9]*)/i);
            if (match) {
              student.grade = match[1];
              student.section = match[2] || student.section;
            }

            // Ensure the class has CCTV enabled so live stream is active
            const { Class } = require("../models");
            await Class.findOneAndUpdate(
              { schoolCode, classCode },
              {
                $set: {
                  "cctvAccess.enabled": true,
                  "cctvAccess.startTime": "00:00",
                  "cctvAccess.endTime": "23:59",
                  "cctvAccess.days": ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"]
                }
              }
            );
          }

          if (busCode !== undefined) {
            student.transport = student.transport || {};
            student.transport.busCode = busCode || null;
          }
          if (routeCode !== undefined) {
            student.transport = student.transport || {};
            student.transport.routeCode = routeCode || null;
          }

          await student.save();
        }
      }
    }

    // 2. Teacher modifications (multi-class assignment managed anytime by School Admin)
    if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER) {
      const { ClassTeacher } = require("../models");
      const ClassStudentService = require("./classStudent.service");

      if (Array.isArray(classCodes)) {
        const cleanCodes = [...new Set(classCodes.map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
        // Deactivate any classes no longer assigned to this teacher
        await ClassTeacher.updateMany(
          { schoolCode, teacherCode: user.userCode, classCode: { $nin: cleanCodes } },
          { $set: { status: "INACTIVE" } }
        );
        // Activate / assign each selected class
        for (const cCode of cleanCodes) {
          await ClassStudentService.assignTeacherToClass({
            schoolCode,
            classCode: cCode,
            teacherCode: user.userCode,
            isClassTeacher: Boolean(isClassTeacher),
            subject: subject || "General",
            adminUser,
            ipAddress,
            userAgent
          });
        }
      } else if (classCode) {
        await ClassStudentService.assignTeacherToClass({
          schoolCode,
          classCode,
          teacherCode: user.userCode,
          isClassTeacher: Boolean(isClassTeacher),
          subject: subject || "General",
          adminUser,
          ipAddress,
          userAgent
        });
      }
    }

    // 3. Driver modifications (change bus, route)
    if (user.role === ROLES.DRIVER) {
      if (busCode) {
        const { Bus } = require("../models");
        await Bus.updateMany({ schoolCode, driverCode: user.userCode }, { $unset: { driverCode: 1 } });
        await Bus.findOneAndUpdate({ schoolCode, busCode }, { $set: { driverCode: user.userCode } });
      }
    }

    await user.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "USER_MODIFIED",
      resourceType: "USER",
      resourceId: user.userCode,
      reason: "School Admin modified user data & class/bus assignments",
      ipAddress,
      userAgent,
      metadata: { fullName, email, phone, role: user.role, studentCode, classCode, busCode }
    });

    return user;
  }

  /**
   * Retrieve daily class-teacher assignments
   */
  static async getDailyAssignments({ schoolCode, date, classCode, teacherCode }) {
    const { DailyTeacherAssignment } = require("../models");
    const query = { schoolCode };
    if (date) query.date = date;
    if (classCode) query.classCode = classCode;
    if (teacherCode) query.teacherCode = teacherCode;

    const assignments = await DailyTeacherAssignment.find(query).sort({ periodNumber: 1 }).lean();
    return assignments;
  }

  /**
   * Save / sync daily class-teacher assignments (allows one teacher to teach multiple classes)
   */
  static async saveDailyAssignments({ schoolCode, date, assignments = [], adminUser, ipAddress, userAgent }) {
    const { DailyTeacherAssignment, ClassTeacher } = require("../models");
    if (!date) {
      throw new Error("Date (YYYY-MM-DD) is required for daily assignments.");
    }

    const saved = [];
    for (const item of assignments) {
      if (!item.classCode || !item.teacherCode || !item.subject) {
        continue;
      }

      const periodNumber = item.periodNumber || 1;
      const doc = await DailyTeacherAssignment.findOneAndUpdate(
        { schoolCode, date, classCode: item.classCode, periodNumber },
        {
          $set: {
            section: item.section || "",
            periodNumber,
            startTime: item.startTime || "09:00",
            endTime: item.endTime || "09:45",
            subject: item.subject,
            teacherCode: item.teacherCode,
            teacherName: item.teacherName || "Teacher",
            isClassTeacher: !!item.isClassTeacher,
            assignedBy: adminUser.userCode,
            notes: item.notes || ""
          }
        },
        { upsert: true, new: true }
      );
      saved.push(doc);

      // Ensure teacher is linked in ClassTeacher collection so permissions allow assigning homework
      await ClassTeacher.findOneAndUpdate(
        { schoolCode, classCode: item.classCode, teacherCode: item.teacherCode },
        {
          $setOnInsert: {
            isClassTeacher: !!item.isClassTeacher,
            subject: item.subject
          }
        },
        { upsert: true }
      );
    }

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "DAILY_TEACHER_ASSIGNMENTS_UPDATED",
      resourceType: "TEACHER_ASSIGNMENT",
      ipAddress,
      userAgent,
      metadata: { date, count: saved.length }
    });

    return saved;
  }

  /**
   * Get WhatsApp configuration for school
   */
  static async getWhatsAppConfig({ schoolCode }) {
    const { School } = require("../models");
    const school = await School.findOne({ schoolCode }).lean();
    const cfg = school?.settings?.whatsapp || {
      connected: false,
      phoneNumber: "",
      businessAccountId: "",
      status: "DISCONNECTED"
    };
    return {
      schoolCode,
      schoolName: school?.name || schoolCode,
      whatsapp: cfg
    };
  }

  /**
   * Connect or update school WhatsApp connection
   */
  static async updateWhatsAppConfig({
    schoolCode,
    phoneNumber,
    businessAccountId,
    apiKey,
    status = "CONNECTED",
    adminUser,
    ipAddress,
    userAgent
  }) {
    const { School } = require("../models");
    const school = await School.findOne({ schoolCode });
    if (!school) {
      throw new Error(`School ${schoolCode} not found.`);
    }

    school.settings = school.settings || {};
    school.settings.whatsapp = {
      connected: status === "CONNECTED",
      phoneNumber: phoneNumber || school.settings.whatsapp?.phoneNumber || "",
      businessAccountId: businessAccountId || school.settings.whatsapp?.businessAccountId || "",
      apiKey: apiKey || school.settings.whatsapp?.apiKey || "",
      connectedAt: new Date(),
      status
    };

    await school.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "WHATSAPP_CONFIG_UPDATED",
      resourceType: "SCHOOL",
      ipAddress,
      userAgent,
      metadata: { phoneNumber, status }
    });

    return school.settings.whatsapp;
  }

  /**
   * Test school WhatsApp connection by dispatching a verification test message
   */
  static async testWhatsAppConnection({ schoolCode, testPhone, adminUser, ipAddress, userAgent }) {
    const { School } = require("../models");
    const NotificationSenderService = require("./notificationSender.service");

    const school = await School.findOne({ schoolCode });
    if (!school) {
      throw new Error(`School ${schoolCode} not found.`);
    }

    const cfg = school.settings?.whatsapp;
    const recipient = testPhone || cfg?.phoneNumber || adminUser?.phone;
    if (!recipient) {
      throw new Error("Recipient phone number is required to perform WhatsApp connection test.");
    }

    const testMessage =
      `*School Safe Connect - WhatsApp Channel Verified* 🟢\n\n` +
      `School: *${school.name}* (${schoolCode})\n` +
      `System Status: Live & Connected\n` +
      `Tested By: ${adminUser.fullName || "Administrator"}\n` +
      `Timestamp: ${new Date().toLocaleString("en-IN")}\n\n` +
      `This confirms your school WhatsApp gateway is functioning properly. Instant notifications for Fee Reminders, AI Exam OMR Results, and Emergency Notices are fully operational.\n\n` +
      `_School Safe Connect Automated Communication Gateway_`;

    await NotificationSenderService.sendWhatsApp({
      phone: recipient,
      message: testMessage
    });

    school.settings = school.settings || {};
    school.settings.whatsapp = school.settings.whatsapp || {};
    school.settings.whatsapp.connected = true;
    school.settings.whatsapp.status = "CONNECTED";
    school.settings.whatsapp.lastTestedAt = new Date();
    await school.save();

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "WHATSAPP_TEST_PERFORMED",
      resourceType: "SCHOOL",
      ipAddress,
      userAgent,
      metadata: { recipient, status: "SUCCESS" }
    });

    return {
      success: true,
      recipient,
      testedAt: school.settings.whatsapp.lastTestedAt,
      status: "CONNECTED",
      message: `WhatsApp test message successfully dispatched to ${recipient}. Channel is verified and live.`
    };
  }

  /**
   * Broadcast an instant WhatsApp notification to parents/teachers
   */
  static async sendWhatsAppBroadcast({
    schoolCode,
    target = "CLASS",
    classCode,
    title,
    message,
    adminUser,
    ipAddress,
    userAgent
  }) {
    const { School, Student, ParentStudentLink, User } = require("../models");
    const NotificationSenderService = require("./notificationSender.service");

    const school = await School.findOne({ schoolCode }).lean();
    const schoolName = school?.name || schoolCode;

    if (!message) {
      throw new Error("Broadcast message content is required.");
    }

    let targetPhones = new Set();

    if (target === "CLASS" && classCode) {
      const students = await Student.find({ schoolCode, classCode, status: "ACTIVE" }).lean();
      for (const st of students) {
        const link = await ParentStudentLink.findOne({ schoolCode, studentCode: st.studentCode, isPrimaryContact: true }).lean();
        if (link) {
          const parent = await User.findOne({ userCode: link.parentCode }).lean();
          if (parent?.phone) targetPhones.add(parent.phone);
        }
        if (st.emergencyContacts?.[0]?.phone) {
          targetPhones.add(st.emergencyContacts[0].phone);
        }
      }
    } else if (target === "TEACHERS") {
      const teachers = await User.find({ schoolCode, role: "TEACHER", status: "ACTIVE" }).lean();
      for (const t of teachers) {
        if (t.phone) targetPhones.add(t.phone);
      }
    } else {
      // ALL_PARENTS
      const parents = await User.find({ schoolCode, role: "PARENT", status: "ACTIVE" }).lean();
      for (const p of parents) {
        if (p.phone) targetPhones.add(p.phone);
      }
    }

    const phoneList = Array.from(targetPhones);
    let dispatched = 0;

    const formattedMessage =
      `*Announcement from ${schoolName}*\n\n` +
      (title ? `*${title.toUpperCase()}*\n\n` : "") +
      `${message}\n\n` +
      `_School Safe Connect Broadcast Gateway_`;

    for (const phone of phoneList) {
      try {
        await NotificationSenderService.sendWhatsApp({ phone, message: formattedMessage });
        dispatched++;
      } catch (_) {}
    }

    await AuditService.log({
      schoolCode,
      actor: SchoolAdminService._actor(adminUser),
      action: "WHATSAPP_BROADCAST_SENT",
      resourceType: "NOTIFICATION",
      ipAddress,
      userAgent,
      metadata: { target, classCode, recipientsCount: phoneList.length, dispatched }
    });

    return {
      success: true,
      recipientsCount: phoneList.length,
      dispatched,
      target
    };
  }
}

module.exports = SchoolAdminService;
