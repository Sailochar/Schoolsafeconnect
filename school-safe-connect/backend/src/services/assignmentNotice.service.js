/**
 * Assignment, Notice, and Class Communication Service
 * Tenant/class-scoped, RBAC-aware, audited operations.
 */

const { v4: uuidv4 } = require("uuid");
const { Assignment, AssignmentSubmission, Notice, Class, ClassTeacher, ParentStudentLink, Student, User, ParentQuery } = require("../models");
const AuditService = require("./audit.service");
const NotificationService = require("./notification.service");
const { ROLES, NOTIFICATION_PRIORITY, PARENT_VERIFICATION_STATUS } = require("../config/constants");

const PRIORITY_QUERY_TYPES = new Set(["SAFETY", "MEDICAL", "BULLYING", "PANIC"]);

function httpError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function genCode(prefix) {
  return `${prefix}-${Date.now().toString(36).toUpperCase()}-${uuidv4().slice(0, 6).toUpperCase()}`;
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isSchoolAdmin(user) {
  return user && user.role === ROLES.SCHOOL_ADMIN;
}

function normalizeArray(arr) {
  return Array.isArray(arr) ? arr : [];
}

class AssignmentNoticeService {
  static async assertTeacherClassAccess({ schoolCode, teacherUser, classCode }) {
    if (isSchoolAdmin(teacherUser)) {return;}
    const assignmentRecord = await ClassTeacher.findOne({
      schoolCode,
      classCode,
      teacherCode: teacherUser.userCode,
      status: "ACTIVE"
    });
    if (!assignmentRecord) {
      throw httpError(`Access denied: teacher [${teacherUser.userCode}] is not assigned to class [${classCode}].`, 403);
    }
  }

  static async getVerifiedParentLink({ schoolCode, parentUser, studentCode }) {
    const link = await ParentStudentLink.findOne({
      schoolCode,
      parentCode: parentUser.userCode,
      studentCode,
      status: PARENT_VERIFICATION_STATUS.VERIFIED
    });
    if (!link) {
      throw httpError(`Access denied: no verified parent-student link for student [${studentCode}].`, 403);
    }
    return link;
  }

  static async getStudentForTenant({ schoolCode, studentCode }) {
    const student = await Student.findOne({ schoolCode, studentCode });
    if (!student) {throw httpError(`Student [${studentCode}] not found.`, 404);}
    return student;
  }

  static async listMyClasses({ schoolCode, teacherUser }) {
    if (isSchoolAdmin(teacherUser)) {
      const classes = await Class.find({ schoolCode }).sort({ grade: 1, section: 1 }).lean();
      return classes.map((c) => ({ ...c, subject: "All Subjects", isClassTeacher: true }));
    }

    const assignments = await ClassTeacher.find({
      schoolCode,
      teacherCode: teacherUser.userCode,
      status: "ACTIVE"
    }).lean();

    if (!assignments.length) return [];

    const classCodes = assignments.map((a) => a.classCode);
    const [classes, studentCounts] = await Promise.all([
      Class.find({ schoolCode, classCode: { $in: classCodes } }).lean(),
      Student.aggregate([
        { $match: { schoolCode, classCode: { $in: classCodes }, status: "ACTIVE" } },
        { $group: { _id: "$classCode", count: { $sum: 1 } } }
      ])
    ]);

    const clsMap = new Map(classes.map((c) => [c.classCode, c]));
    const countMap = new Map(studentCounts.map((s) => [s._id, s.count]));

    return assignments.map((a) => {
      const cls = clsMap.get(a.classCode) || {};
      return {
        classCode: a.classCode,
        grade: cls.grade || "",
        section: cls.section || "",
        roomNumber: cls.roomNumber || "",
        subject: a.subject || "General",
        isClassTeacher: Boolean(a.isClassTeacher),
        studentCount: countMap.get(a.classCode) || 0
      };
    });
  }

  static async createAssignment(payload) {
    const {
      schoolCode,
      teacherUser,
      classCode,
      classCodes,
      subject = "General",
      title,
      description,
      format = "TEXT",
      assignmentType = "HOMEWORK",
      attachments = [],
      dueDate,
      maxScore = 100,
      status = "PUBLISHED",
      ipAddress,
      userAgent
    } = payload;

    // Resolve single or multiple target classes assigned to this teacher
    let targets = Array.isArray(classCodes) && classCodes.length > 0 ? classCodes : (classCode ? [classCode] : []);
    if (targets.length === 0 && !isSchoolAdmin(teacherUser)) {
      const myCls = await ClassTeacher.find({ schoolCode, teacherCode: teacherUser.userCode, status: "ACTIVE" }).select("classCode").lean();
      if (myCls.length > 0) {
        targets = [myCls[0].classCode];
      }
    }
    if (targets.length === 0) {
      throw httpError("Please select at least one assigned class for this assignment. Ask School Admin to assign you to a class.", 400);
    }

    const uniqueTargets = [...new Set(targets.map((c) => String(c).trim().toUpperCase()))];
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // Auto-expires & deletes after 7 days (1 week)
    const createdAssignments = [];

    for (const targetClassCode of uniqueTargets) {
      await this.assertTeacherClassAccess({ schoolCode, teacherUser, classCode: targetClassCode });
      const cls = await Class.findOne({ schoolCode, classCode: targetClassCode });
      if (!cls) {throw httpError(`Class [${targetClassCode}] not found.`, 404);}

      const assignmentCode = genCode(`${schoolCode}-ASN`);
      const assignment = await Assignment.create({
        schoolCode,
        assignmentCode,
        classCode: targetClassCode,
        teacherCode: teacherUser.userCode,
        teacherName: teacherUser.fullName || teacherUser.userCode,
        subject,
        title,
        description,
        format,
        assignmentType,
        attachments,
        dueDate: new Date(dueDate),
        expiresAt,
        maxScore,
        status
      });

      if (status === "PUBLISHED") {
        await NotificationService.notifyClassParents({
          schoolCode,
          classCode: targetClassCode,
          title: `New Homework (${subject}): ${title}`,
          message: `${teacherUser.fullName || "Teacher"} posted ${subject} assignment for ${targetClassCode}. Due: ${new Date(dueDate).toLocaleDateString()}. Auto-expires in 7 days.`,
          eventType: "ASSIGNMENT_UPLOADED",
          priority: NOTIFICATION_PRIORITY.NORMAL,
          metadata: { assignmentCode, classCode: targetClassCode, subject }
        });
      }

      await AuditService.log({
        schoolCode,
        actor: { userCode: teacherUser.userCode, role: teacherUser.role, fullName: teacherUser.fullName, email: teacherUser.email },
        action: "ASSIGNMENT_CREATED",
        resourceType: "ASSIGNMENT",
        resourceId: assignmentCode,
        reason: "Teacher/admin created class-scoped assignment (7-day TTL)",
        ipAddress,
        userAgent,
        metadata: { classCode: targetClassCode, subject, title, status, expiresAt }
      });

      createdAssignments.push(assignment.toObject());
    }

    return createdAssignments.length === 1 ? createdAssignments[0] : createdAssignments;
  }

  static async updateAssignment(payload) {
    const { schoolCode, actorUser, assignmentCode, updates, ipAddress, userAgent } = payload;
    const assignment = await Assignment.findOne({ schoolCode, assignmentCode });
    if (!assignment) {throw httpError(`Assignment [${assignmentCode}] not found.`, 404);}
    await this.assertTeacherClassAccess({ schoolCode, teacherUser: actorUser, classCode: assignment.classCode });

    const before = { status: assignment.status, title: assignment.title, dueDate: assignment.dueDate };
    const allowed = ["subject", "title", "description", "attachments", "dueDate", "maxScore", "status"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        assignment[key] = key === "dueDate" ? new Date(updates[key]) : updates[key];
      }
    }
    await assignment.save();

    const becamePublished = before.status !== "PUBLISHED" && assignment.status === "PUBLISHED";
    if (becamePublished) {
      await NotificationService.notifyClassParents({
        schoolCode,
        classCode: assignment.classCode,
        title: `New Assignment: ${assignment.title}`,
        message: `${assignment.subject} assignment posted for class ${assignment.classCode}. Due: ${new Date(assignment.dueDate).toLocaleDateString()}`,
        eventType: "ASSIGNMENT_UPLOADED",
        priority: NOTIFICATION_PRIORITY.NORMAL,
        metadata: { assignmentCode: assignment.assignmentCode, classCode: assignment.classCode }
      });
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: actorUser.userCode, role: actorUser.role, fullName: actorUser.fullName, email: actorUser.email },
      action: "ASSIGNMENT_UPDATED",
      resourceType: "ASSIGNMENT",
      resourceId: assignmentCode,
      reason: "Assignment updated/archived",
      ipAddress,
      userAgent,
      metadata: { before, after: { status: assignment.status, title: assignment.title, dueDate: assignment.dueDate }, updates: Object.keys(updates) }
    });

    return assignment.toObject();
  }

  static async getAssignmentDetail({ schoolCode, user, assignmentCode }) {
    const assignment = await Assignment.findOne({ schoolCode, assignmentCode }).lean();
    if (!assignment) {throw httpError(`Assignment [${assignmentCode}] not found.`, 404);}

    if (user.role === ROLES.SCHOOL_ADMIN) {
      // ok
    } else if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER) {
      await this.assertTeacherClassAccess({ schoolCode, teacherUser: user, classCode: assignment.classCode });
    } else if (user.role === ROLES.PARENT) {
      const links = await ParentStudentLink.find({ schoolCode, parentCode: user.userCode, status: PARENT_VERIFICATION_STATUS.VERIFIED }).lean();
      const studentCodes = links.map((l) => l.studentCode);
      if (!studentCodes.length) {throw httpError("Access denied: no verified linked children.", 403);}
      const linked = await Student.exists({ schoolCode, studentCode: { $in: studentCodes }, classCode: assignment.classCode });
      if (!linked) {throw httpError("Access denied: assignment not in scope of your verified children.", 403);}
      if (assignment.status !== "PUBLISHED") {throw httpError("Assignment not available.", 403);}
    } else {
      throw httpError("Access denied.", 403);
    }

    const [studentsInClass, submissions] = await Promise.all([
      Student.find({ schoolCode, classCode: assignment.classCode, status: "ACTIVE" }).select("studentCode").lean(),
      AssignmentSubmission.find({ schoolCode, assignmentCode }).select("studentCode viewedByParentAt submittedAt status score").lean()
    ]);

    const byStudent = new Map(submissions.map((s) => [s.studentCode, s]));
    let viewedCount = 0;
    let submittedCount = 0;
    const studentStatuses = studentsInClass.map((s) => {
      const sub = byStudent.get(s.studentCode);
      const viewed = !!sub?.viewedByParentAt;
      const submitted = !!sub?.submittedAt;
      if (viewed) {viewedCount += 1;}
      if (submitted) {submittedCount += 1;}
      return {
        studentCode: s.studentCode,
        viewedByParent: viewed,
        viewedByParentAt: sub?.viewedByParentAt || null,
        submittedAt: sub?.submittedAt || null,
        status: sub?.status || null,
        score: sub?.score ?? null
      };
    });

    const summary = {
      totalStudents: studentsInClass.length,
      viewedCount,
      submittedCount,
      notViewedCount: Math.max(studentsInClass.length - viewedCount, 0)
    };

    const result = { ...assignment, deliverySummary: summary };
    if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER || user.role === ROLES.SCHOOL_ADMIN) {
      result.studentStatuses = studentStatuses;
    }
    return result;
  }

  static async listAssignmentsForClass({ schoolCode, user, classCode, includeDraft = false }) {
    if (user.role === ROLES.SCHOOL_ADMIN) {
      // ok
    } else if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER) {
      await this.assertTeacherClassAccess({ schoolCode, teacherUser: user, classCode });
    } else if (user.role === ROLES.PARENT) {
      const links = await ParentStudentLink.find({ schoolCode, parentCode: user.userCode, status: PARENT_VERIFICATION_STATUS.VERIFIED }).lean();
      const studentCodes = links.map((l) => l.studentCode);
      if (!studentCodes.length) {throw httpError("Access denied: no verified linked children.", 403);}
      const allowed = await Student.exists({ schoolCode, studentCode: { $in: studentCodes }, classCode });
      if (!allowed) {throw httpError("Access denied: class not in scope of your verified children.", 403);}
    } else {
      throw httpError("Access denied.", 403);
    }

    const query = { schoolCode, classCode };
    if (user.role === ROLES.PARENT) {
      query.status = "PUBLISHED";
    } else if (!includeDraft) {
      // teachers/admin default to published unless explicitly requested
      // keep drafts visible to staff by default? includeDraft controls
    }
    if (!includeDraft && user.role !== ROLES.PARENT) {
      query.status = { $in: ["PUBLISHED", "DRAFT"] };
    }

    const assignments = await Assignment.find(query).sort({ dueDate: -1, createdAt: -1 }).lean();
    if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER || user.role === ROLES.SCHOOL_ADMIN) {
      const assignmentCodes = assignments.map((a) => a.assignmentCode);
      if (assignmentCodes.length) {
        const [studentCount, subs] = await Promise.all([
          Student.countDocuments({ schoolCode, classCode, status: "ACTIVE" }),
          AssignmentSubmission.aggregate([
            { $match: { schoolCode, assignmentCode: { $in: assignmentCodes } } },
            { $group: { _id: "$assignmentCode", viewed: { $sum: { $cond: [{ $ifNull: ["$viewedByParentAt", false] }, 1, 0] } }, submitted: { $sum: { $cond: [{ $ifNull: ["$submittedAt", false] }, 1, 0] } } } }
          ])
        ]);
        const byCode = new Map(subs.map((s) => [s._id, s]));
        for (const a of assignments) {
          const s = byCode.get(a.assignmentCode) || { viewed: 0, submitted: 0 };
          a.deliverySummary = { totalStudents: studentCount, viewedCount: s.viewed, submittedCount: s.submitted, notViewedCount: Math.max(studentCount - s.viewed, 0) };
        }
      }
    }
    return assignments;
  }

  static async listAssignmentsForUser({ schoolCode, user, classCode }) {
    const now = new Date();
    const activeExpiryFilter = { $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }] };

    if (user.role === ROLES.PARENT) {
      const links = await ParentStudentLink.find({
        schoolCode,
        parentCode: user.userCode,
        status: PARENT_VERIFICATION_STATUS.VERIFIED
      }).lean();
      const studentCodes = links.map((l) => l.studentCode);
      if (!studentCodes.length) return [];

      const students = await Student.find({ schoolCode, studentCode: { $in: studentCodes } }).lean();
      const childClassCodes = [...new Set(students.map((s) => s.classCode).filter(Boolean))];
      if (!childClassCodes.length) return [];

      const targetClasses = classCode && childClassCodes.includes(classCode.toUpperCase())
        ? [classCode.toUpperCase()]
        : childClassCodes;

      const assignments = await Assignment.find({
        schoolCode,
        classCode: { $in: targetClasses },
        status: "PUBLISHED",
        ...activeExpiryFilter
      }).sort({ createdAt: -1, dueDate: 1 }).lean();

      const codes = assignments.map((a) => a.assignmentCode);
      const submissions = await AssignmentSubmission.find({
        schoolCode,
        studentCode: { $in: studentCodes },
        assignmentCode: { $in: codes }
      }).lean();
      const byCode = new Map(submissions.map((s) => [s.assignmentCode, s]));

      // Enrich missing teacher names
      const teacherCodes = [...new Set(assignments.map((a) => a.teacherCode).filter(Boolean))];
      const teachers = await User.find({ schoolCode, userCode: { $in: teacherCodes } }).select("userCode fullName").lean();
      const teacherMap = new Map(teachers.map((t) => [t.userCode, t.fullName]));

      return assignments.map((a) => {
        const sub = byCode.get(a.assignmentCode);
        return {
          ...a,
          teacherName: a.teacherName || teacherMap.get(a.teacherCode) || a.teacherCode,
          viewedByParentAt: sub?.viewedByParentAt || null,
          isViewed: Boolean(sub?.viewedByParentAt),
          submittedAt: sub?.submittedAt || null
        };
      });
    }

    let filterClasses = null;
    if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER) {
      const assigned = await ClassTeacher.find({
        schoolCode,
        teacherCode: user.userCode,
        status: "ACTIVE"
      }).select("classCode").lean();
      filterClasses = assigned.map((c) => c.classCode);
      if (classCode) {
        if (!filterClasses.includes(classCode.toUpperCase())) return [];
        filterClasses = [classCode.toUpperCase()];
      }
      if (!filterClasses.length) return [];
    } else if (classCode) {
      filterClasses = [classCode.toUpperCase()];
    }

    const query = {
      schoolCode,
      status: { $in: ["PUBLISHED", "DRAFT"] },
      ...activeExpiryFilter,
      ...(filterClasses ? { classCode: { $in: filterClasses } } : {})
    };

    const assignments = await Assignment.find(query).sort({ createdAt: -1 }).lean();
    if (!assignments.length) return [];

    const assignmentCodes = assignments.map((a) => a.assignmentCode);
    const involvedClasses = [...new Set(assignments.map((a) => a.classCode))];

    const [classCounts, subs, teachers] = await Promise.all([
      Student.aggregate([
        { $match: { schoolCode, classCode: { $in: involvedClasses }, status: "ACTIVE" } },
        { $group: { _id: "$classCode", count: { $sum: 1 } } }
      ]),
      AssignmentSubmission.aggregate([
        { $match: { schoolCode, assignmentCode: { $in: assignmentCodes } } },
        {
          $group: {
            _id: "$assignmentCode",
            viewed: { $sum: { $cond: [{ $ifNull: ["$viewedByParentAt", false] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $ifNull: ["$submittedAt", false] }, 1, 0] } }
          }
        }
      ]),
      User.find({ schoolCode, userCode: { $in: [...new Set(assignments.map((a) => a.teacherCode))] } }).select("userCode fullName").lean()
    ]);

    const countByClass = new Map(classCounts.map((c) => [c._id, c.count]));
    const subByCode = new Map(subs.map((s) => [s._id, s]));
    const teacherMap = new Map(teachers.map((t) => [t.userCode, t.fullName]));

    return assignments.map((a) => {
      const totalStudents = countByClass.get(a.classCode) || 0;
      const s = subByCode.get(a.assignmentCode) || { viewed: 0, submitted: 0 };
      return {
        ...a,
        teacherName: a.teacherName || teacherMap.get(a.teacherCode) || a.teacherCode,
        deliverySummary: {
          totalStudents,
          viewedCount: s.viewed,
          submittedCount: s.submitted,
          notViewedCount: Math.max(totalStudents - s.viewed, 0)
        }
      };
    });
  }

  static async listAssignmentsForParent({ schoolCode, parentUser, studentCode }) {
    await this.getVerifiedParentLink({ schoolCode, parentUser, studentCode });
    const student = await this.getStudentForTenant({ schoolCode, studentCode });
    const now = new Date();
    const assignments = await Assignment.find({
      schoolCode,
      classCode: student.classCode,
      status: "PUBLISHED",
      $or: [{ expiresAt: { $gt: now } }, { expiresAt: { $exists: false } }]
    }).sort({ createdAt: -1, dueDate: 1 }).lean();
    const codes = assignments.map((a) => a.assignmentCode);
    const submissions = await AssignmentSubmission.find({ schoolCode, studentCode, assignmentCode: { $in: codes } }).lean();
    const byCode = new Map(submissions.map((s) => [s.assignmentCode, s]));
    return assignments.map((a) => {
      const sub = byCode.get(a.assignmentCode);
      return {
        ...a,
        viewedByParentAt: sub?.viewedByParentAt || null,
        isViewed: Boolean(sub?.viewedByParentAt),
        submittedAt: sub?.submittedAt || null,
        submissionStatus: sub?.status || null,
        score: sub?.score ?? null
      };
    });
  }

  static async markAssignmentViewed({ schoolCode, assignmentCode, studentCode, parentUser, ipAddress, userAgent }) {
    await this.getVerifiedParentLink({ schoolCode, parentUser, studentCode });
    const student = await this.getStudentForTenant({ schoolCode, studentCode });
    const assignment = await Assignment.findOne({ schoolCode, assignmentCode, status: "PUBLISHED" });
    if (!assignment) {throw httpError(`Assignment [${assignmentCode}] not found.`, 404);}
    if (assignment.classCode !== student.classCode) {
      throw httpError("Access denied: assignment does not belong to the student's class.", 403);
    }

    const record = await AssignmentSubmission.findOneAndUpdate(
      { schoolCode, assignmentCode, studentCode },
      { $set: { parentCode: parentUser.userCode, viewedByParentAt: new Date() }, $setOnInsert: { submittedAt: null } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();

    await AuditService.log({
      schoolCode,
      actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email },
      action: "ASSIGNMENT_VIEWED_BY_PARENT",
      resourceType: "ASSIGNMENT_SUBMISSION",
      resourceId: `${assignmentCode}:${studentCode}`,
      reason: "Parent marked assignment as viewed for verified child",
      ipAddress,
      userAgent,
      metadata: { assignmentCode, studentCode, classCode: assignment.classCode }
    });

    return record;
  }

  static async publishNotice(payload) {
    const {
      schoolCode,
      publisherUser,
      title,
      content,
      category = "GENERAL",
      examDetails,
      targetRoles,
      classCodes = [],
      priority = NOTIFICATION_PRIORITY.NORMAL,
      attachments = [],
      expiresAt,
      status = "PUBLISHED",
      ipAddress,
      userAgent
    } = payload;

    if (publisherUser.role === ROLES.CLASS_TEACHER || publisherUser.role === ROLES.SUBJECT_TEACHER) {
      const uniqueClasses = [...new Set(normalizeArray(classCodes))];
      if (!uniqueClasses.length) {throw httpError("Teachers must specify at least one classCode for a notice.", 400);}
      for (const classCode of uniqueClasses) {
        await this.assertTeacherClassAccess({ schoolCode, teacherUser: publisherUser, classCode });
      }
    }

    const noticeCode = genCode(`${schoolCode}-NOT`);
    const notice = await Notice.create({
      schoolCode,
      noticeCode,
      title,
      content,
      category,
      publisherName: publisherUser.fullName || publisherUser.userCode,
      publisherRole: publisherUser.role,
      examDetails: category === "EXAM" && examDetails ? examDetails : undefined,
      publishedBy: publisherUser.userCode,
      targetRoles: targetRoles && targetRoles.length ? targetRoles : ["PARENT", "CLASS_TEACHER", "SUBJECT_TEACHER"],
      classCodes: normalizeArray(classCodes),
      priority,
      attachments,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      status
    });

    if (status === "PUBLISHED") {
      await NotificationService.dispatchNoticeNotifications({ schoolCode, notice: notice.toObject() });
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: publisherUser.userCode, role: publisherUser.role, fullName: publisherUser.fullName, email: publisherUser.email },
      action: "NOTICE_PUBLISHED",
      resourceType: "NOTICE",
      resourceId: noticeCode,
      reason: "Notice created/published",
      ipAddress,
      userAgent,
      metadata: { priority, targetRoles: notice.targetRoles, classCodes: notice.classCodes, status }
    });

    return notice.toObject();
  }

  static async updateNotice(payload) {
    const { schoolCode, actorUser, noticeCode, updates, ipAddress, userAgent } = payload;
    const notice = await Notice.findOne({ schoolCode, noticeCode });
    if (!notice) {throw httpError(`Notice [${noticeCode}] not found.`, 404);}

    if (!isSchoolAdmin(actorUser)) {
      if (notice.publishedBy !== actorUser.userCode) {throw httpError("Access denied: you can only update notices you published.", 403);}
      if ((actorUser.role === ROLES.CLASS_TEACHER || actorUser.role === ROLES.SUBJECT_TEACHER) && updates.classCodes) {
        for (const classCode of normalizeArray(updates.classCodes)) {
          await this.assertTeacherClassAccess({ schoolCode, teacherUser: actorUser, classCode });
        }
      }
    }

    const before = { status: notice.status, title: notice.title };
    const allowed = ["title", "content", "targetRoles", "classCodes", "priority", "attachments", "expiresAt", "status"];
    for (const key of allowed) {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        notice[key] = key === "expiresAt" ? (updates[key] ? new Date(updates[key]) : undefined) : updates[key];
      }
    }
    await notice.save();

    if (before.status !== "PUBLISHED" && notice.status === "PUBLISHED") {
      await NotificationService.dispatchNoticeNotifications({ schoolCode, notice: notice.toObject() });
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: actorUser.userCode, role: actorUser.role, fullName: actorUser.fullName, email: actorUser.email },
      action: "NOTICE_UPDATED",
      resourceType: "NOTICE",
      resourceId: noticeCode,
      reason: "Notice updated/archived",
      ipAddress,
      userAgent,
      metadata: { before, after: { status: notice.status, title: notice.title }, updates: Object.keys(updates) }
    });

    return notice.toObject();
  }

  static async listNoticesForUser({ schoolCode, user }) {
    const now = new Date();
    const base = {
      schoolCode,
      status: "PUBLISHED",
      $or: [{ expiresAt: { $exists: false } }, { expiresAt: null }, { expiresAt: { $gte: now } }]
    };

    if (user.role === ROLES.SCHOOL_ADMIN) {
      const notices = await Notice.find(base).sort({ createdAt: -1 }).lean();
      return notices;
    }

    if (user.role === ROLES.PARENT) {
      const links = await ParentStudentLink.find({ schoolCode, parentCode: user.userCode, status: PARENT_VERIFICATION_STATUS.VERIFIED }).lean();
      const studentCodes = links.map((l) => l.studentCode);
      const students = studentCodes.length ? await Student.find({ schoolCode, studentCode: { $in: studentCodes } }).select("classCode").lean() : [];
      const classCodes = [...new Set(students.map((s) => s.classCode).filter(Boolean))];
      const query = {
        ...base,
        $and: [
          { $or: [{ targetRoles: { $exists: false } }, { targetRoles: { $size: 0 } }, { targetRoles: user.role }] },
          { $or: [{ classCodes: { $exists: false } }, { classCodes: { $size: 0 } }, ...(classCodes.length ? [{ classCodes: { $in: classCodes } }] : [])] }
        ]
      };
      return Notice.find(query).sort({ priority: -1, createdAt: -1 }).lean();
    }

    if (user.role === ROLES.CLASS_TEACHER || user.role === ROLES.SUBJECT_TEACHER) {
      const teacherClasses = await ClassTeacher.find({ schoolCode, teacherCode: user.userCode, status: "ACTIVE" }).select("classCode").lean();
      const classCodes = [...new Set(teacherClasses.map((c) => c.classCode))];
      const query = {
        ...base,
        $and: [
          { $or: [{ targetRoles: { $exists: false } }, { targetRoles: { $size: 0 } }, { targetRoles: user.role }] },
          { $or: [{ classCodes: { $exists: false } }, { classCodes: { $size: 0 } }, ...(classCodes.length ? [{ classCodes: { $in: classCodes } }] : [])] }
        ]
      };
      return Notice.find(query).sort({ priority: -1, createdAt: -1 }).lean();
    }

    // Other roles: target-role match, class-scoped notices excluded unless explicitly no classes
    const query = {
      ...base,
      $and: [
        { $or: [{ targetRoles: { $exists: false } }, { targetRoles: { $size: 0 } }, { targetRoles: user.role }] },
        { $or: [{ classCodes: { $exists: false } }, { classCodes: { $size: 0 } }] }
      ]
    };
    return Notice.find(query).sort({ priority: -1, createdAt: -1 }).lean();
  }

  static async handleParentQuery(payload) {
    const { schoolCode, parentUser, studentCode, queryType = "NORMAL", subject, message, ipAddress, userAgent } = payload;
    const normalizedType = String(queryType || "NORMAL").toUpperCase();
    const isPriorityConcern = PRIORITY_QUERY_TYPES.has(normalizedType);

    await this.getVerifiedParentLink({ schoolCode, parentUser, studentCode });
    const student = await this.getStudentForTenant({ schoolCode, studentCode });

    const today = todayKey();
    if (!isPriorityConcern) {
      const updated = await User.findOneAndUpdate(
        {
          schoolCode,
          userCode: parentUser.userCode,
          $or: [
            { dailyQueryDate: { $ne: today } },
            { dailyQueryDate: { $exists: false } },
            { dailyQueryDate: null },
            { dailyQueryDate: today, dailyQueryCount: { $lt: 1 } }
          ]
        },
        [
          {
            $set: {
              dailyQueryDate: today,
              dailyQueryCount: {
                $cond: [{ $eq: ["$dailyQueryDate", today] }, { $add: ["$dailyQueryCount", 1] }, 1]
              }
            }
          }
        ],
        { new: true }
      ).lean();
      if (!updated) {
        throw httpError("Daily query limit reached: 1 normal query per day. Safety, medical, bullying, or panic concerns bypass this limit.", 429);
      }
    }

    const classTeacherAssignment = await ClassTeacher.findOne({
      schoolCode,
      classCode: student.classCode,
      isClassTeacher: true,
      status: "ACTIVE"
    }).lean();
    let teacherCode = classTeacherAssignment ? classTeacherAssignment.teacherCode : null;
    if (!teacherCode) {
      const fallback = await ClassTeacher.findOne({ schoolCode, classCode: student.classCode, status: "ACTIVE" }).lean();
      teacherCode = fallback ? fallback.teacherCode : null;
    }

    const queryCode = genCode(`${schoolCode}-QRY`);
    await ParentQuery.create({
      schoolCode,
      queryCode,
      classCode: student.classCode,
      studentCode,
      parentCode: parentUser.userCode,
      teacherCode: teacherCode || undefined,
      queryType: normalizedType,
      subject,
      message,
      status: "OPEN",
      bypassedDailyLimit: isPriorityConcern
    });

    if (teacherCode) {
      await NotificationService.sendDirectNotification({
        schoolCode,
        recipientUserCode: teacherCode,
        title: `Parent Query (${normalizedType}) - ${student.fullName}`,
        message: `Subject: ${subject}\n${message}`,
        eventType: "PARENT_QUERY_RECEIVED",
        priority: isPriorityConcern ? NOTIFICATION_PRIORITY.CRITICAL : NOTIFICATION_PRIORITY.NORMAL,
        metadata: { queryCode, studentCode, classCode: student.classCode, queryType: normalizedType }
      });
    } else {
      await NotificationService.alertSafetyStakeholders({
        schoolCode,
        title: `Unassigned Parent Query (${normalizedType})`,
        message: `No active teacher for class ${student.classCode}. Student ${studentCode}. ${subject}`,
        eventType: "PARENT_QUERY_RECEIVED",
        metadata: { queryCode, studentCode, classCode: student.classCode }
      });
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email },
      action: isPriorityConcern ? "PARENT_PRIORITY_QUERY_SUBMITTED" : "PARENT_QUERY_SUBMITTED",
      resourceType: "PARENT_QUERY",
      resourceId: queryCode,
      reason: isPriorityConcern ? "Priority concern bypassed daily limit" : "Normal parent query submitted",
      ipAddress,
      userAgent,
      metadata: { studentCode, classCode: student.classCode, queryType: normalizedType, teacherCode, bypassedDailyLimit: isPriorityConcern }
    });

    return {
      queryCode,
      queryType: normalizedType,
      bypassedDailyLimit: isPriorityConcern,
      routedToTeacher: teacherCode || "UNASSIGNED",
      status: "OPEN"
    };
  }

  static async listParentQueries({ schoolCode, parentUser, studentCode }) {
    const query = { schoolCode, parentCode: parentUser.userCode };
    if (studentCode) {
      await this.getVerifiedParentLink({ schoolCode, parentUser, studentCode });
      query.studentCode = studentCode;
    }
    return ParentQuery.find(query).sort({ createdAt: -1 }).lean();
  }

  static async listTeacherQueries({ schoolCode, teacherUser, status }) {
    const cls = await ClassTeacher.find({ schoolCode, teacherCode: teacherUser.userCode, status: "ACTIVE" }).select("classCode").lean();
    const classCodes = cls.map((c) => c.classCode);
    const query = { schoolCode, $or: [{ teacherCode: teacherUser.userCode }, ...(classCodes.length ? [{ classCode: { $in: classCodes } }] : [])] };
    if (status) {query.status = status;}
    return ParentQuery.find(query).sort({ createdAt: -1 }).lean();
  }

  static async replyToParentQuery(payload) {
    const { schoolCode, teacherUser, queryCode, reply, status = "ANSWERED", ipAddress, userAgent } = payload;
    const queryDoc = await ParentQuery.findOne({ schoolCode, queryCode });
    if (!queryDoc) {throw httpError(`Parent query [${queryCode}] not found.`, 404);}

    if (!isSchoolAdmin(teacherUser)) {
      await this.assertTeacherClassAccess({ schoolCode, teacherUser, classCode: queryDoc.classCode });
      if (queryDoc.teacherCode && queryDoc.teacherCode !== teacherUser.userCode) {
        const isClassTeacher = await ClassTeacher.exists({ schoolCode, classCode: queryDoc.classCode, teacherCode: teacherUser.userCode, status: "ACTIVE" });
        if (!isClassTeacher) {throw httpError("Access denied: not authorized to reply to this query.", 403);}
      }
    }

    queryDoc.status = status;
    queryDoc.reply = {
      message: reply,
      repliedBy: teacherUser.userCode,
      repliedByRole: teacherUser.role,
      repliedAt: new Date()
    };
    if (!queryDoc.teacherCode) {queryDoc.teacherCode = teacherUser.userCode;}
    await queryDoc.save();

    await NotificationService.sendDirectNotification({
      schoolCode,
      recipientUserCode: queryDoc.parentCode,
      title: "Teacher replied to your query",
      message: reply.slice(0, 500),
      eventType: "PARENT_QUERY_REPLIED",
      priority: NOTIFICATION_PRIORITY.NORMAL,
      metadata: { queryCode, classCode: queryDoc.classCode, studentCode: queryDoc.studentCode }
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: teacherUser.userCode, role: teacherUser.role, fullName: teacherUser.fullName, email: teacherUser.email },
      action: "PARENT_QUERY_REPLIED",
      resourceType: "PARENT_QUERY",
      resourceId: queryCode,
      reason: "Teacher/admin replied to parent query",
      ipAddress,
      userAgent,
      metadata: { status, parentCode: queryDoc.parentCode }
    });

    return queryDoc.toObject();
  }

  static async escalateQueryToSchoolAdmin({ schoolCode, queryCode, parentUser, reason, ipAddress, userAgent }) {
    const queryDoc = await ParentQuery.findOne({ schoolCode, queryCode, parentCode: parentUser.userCode });
    if (!queryDoc) {throw httpError(`Parent query [${queryCode}] not found.`, 404);}

    queryDoc.queryType = "SAFETY";
    queryDoc.status = "ESCALATED";
    await queryDoc.save();

    await NotificationService.alertSafetyStakeholders({
      schoolCode,
      title: `ESCALATED SAFETY CONCERN: ${queryDoc.subject}`,
      message: `Parent ${parentUser.fullName} (${parentUser.userCode}) escalated concern for student ${queryDoc.studentCode}: ${reason || queryDoc.message}`,
      eventType: "PARENT_SAFETY_ESCALATION",
      priority: NOTIFICATION_PRIORITY.CRITICAL,
      metadata: { queryCode, studentCode: queryDoc.studentCode, classCode: queryDoc.classCode }
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email },
      action: "PARENT_QUERY_ESCALATED_TO_ADMIN",
      resourceType: "PARENT_QUERY",
      resourceId: queryCode,
      reason: reason || "Unresolved safety concern escalated to School Admin",
      ipAddress,
      userAgent
    });

    return queryDoc.toObject();
  }
}

module.exports = AssignmentNoticeService;
