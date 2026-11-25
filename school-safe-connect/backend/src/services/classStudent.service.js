/**
 * Class, Student, and Parent-Child Mapping Service
 * Tenant-scoped academic administration and custody linking.
 */

const mongoose = require("mongoose");
const { Class, ClassTeacher, Student, ParentStudentLink, User, School, Bus, Route, Stop } = require("../models");
const IdGeneratorService = require("./idGenerator.service");
const AuditService = require("./audit.service");
const { ROLES, USER_STATUS, PARENT_VERIFICATION_STATUS } = require("../config/constants");

const normalize = (v) => (v === undefined || v === null ? v : String(v).trim().toUpperCase());
const asId = (v) => (v ? String(v) : null);

class ClassStudentService {
  static _httpError(message, statusCode, code) {
    const err = new Error(message);
    err.statusCode = statusCode;
    if (code) {err.code = code;}
    return err;
  }

  static async _getStudentOrThrow(schoolCode, studentCode) {
    const student = await Student.findOne({ schoolCode, studentCode: normalize(studentCode) });
    if (!student) {throw this._httpError("Student not found in this school.", 404);}
    return student;
  }

  static async _getClassOrThrow(schoolCode, classCode) {
    const cls = await Class.findOne({ schoolCode, classCode: normalize(classCode) });
    if (!cls) {throw this._httpError(`Class [${normalize(classCode)}] not found in this school.`, 404);}
    return cls;
  }

  static async createClass({ schoolCode, grade, section, academicYear, roomNumber, capacity, maxCapacity, cctvAccess, adminUser, ipAddress, userAgent }) {
    const g = String(grade).trim();
    const s = String(section).trim().toUpperCase();
    const ay = String(academicYear).trim();
    const classCode = IdGeneratorService.formatClassCode(schoolCode, g, s);

    const existing = await Class.findOne({ schoolCode, $or: [{ classCode, academicYear: ay }, { grade: g, section: s, academicYear: ay }] });
    if (existing) {throw this._httpError(`Class [${classCode}] for academic year [${ay}] already exists.`, 409);}

    const newClass = await Class.create({
      schoolCode,
      classCode,
      grade: g,
      section: s,
      academicYear: ay,
      roomNumber: roomNumber || undefined,
      capacity: capacity || maxCapacity || 40,
      cctvAccess: cctvAccess || undefined
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "CLASS_CREATED",
      resourceType: "CLASS",
      resourceId: classCode,
      reason: "Academic class created by School Admin",
      ipAddress,
      userAgent,
      metadata: { grade: g, section: s, academicYear: ay }
    });

    return newClass;
  }

  static async listClasses(schoolCode, { academicYear, status } = {}) {
    const query = { schoolCode };
    if (academicYear) {query.academicYear = String(academicYear).trim();}
    if (status) {query.status = String(status).trim().toUpperCase();}
    return Class.find(query).sort({ academicYear: -1, grade: 1, section: 1 }).lean();
  }

  static async assignTeacherToClass({ schoolCode, classCode, teacherCode, isClassTeacher = false, subject, academicYear, adminUser, ipAddress, userAgent }) {
    const targetClass = await this._getClassOrThrow(schoolCode, classCode);
    const tCode = normalize(teacherCode);
    const teacher = await User.findOne({ schoolCode, userCode: tCode });
    if (!teacher || ![ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER].includes(teacher.role)) {
      throw this._httpError(`Valid teacher [${tCode}] not found in this school.`, 404);
    }
    if (teacher.status !== USER_STATUS.ACTIVE && teacher.status !== USER_STATUS.APPROVED) {
      throw this._httpError(`Teacher [${tCode}] is not in an active/approved state.`, 409);
    }

    if (isClassTeacher) {
      await ClassTeacher.updateMany({ schoolCode, classCode: targetClass.classCode, isClassTeacher: true }, { $set: { isClassTeacher: false } });
      if (teacher.role === ROLES.SUBJECT_TEACHER) {
        teacher.role = ROLES.CLASS_TEACHER;
        await teacher.save();
      }
    }

    const assignment = await ClassTeacher.findOneAndUpdate(
      { schoolCode, classCode: targetClass.classCode, teacherCode: tCode },
      {
        $set: {
          isClassTeacher: !!isClassTeacher,
          subject: subject ? String(subject).trim() : "General",
          academicYear: academicYear ? String(academicYear).trim() : targetClass.academicYear,
          status: "ACTIVE"
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "CLASS_TEACHER_ASSIGNED",
      resourceType: "CLASS",
      resourceId: targetClass.classCode,
      reason: `Assigned teacher ${tCode} as ${isClassTeacher ? "Class Teacher" : "Subject Teacher"}`,
      ipAddress,
      userAgent,
      metadata: { teacherCode: tCode, isClassTeacher: !!isClassTeacher, subject: assignment.subject }
    });

    return assignment;
  }

  static async updateClassCctvTiming({ schoolCode, classCode, cctvAccess, adminUser, ipAddress, userAgent }) {
    const targetClass = await this._getClassOrThrow(schoolCode, classCode);
    if (cctvAccess.startTime && cctvAccess.endTime && cctvAccess.startTime >= cctvAccess.endTime) {
      throw this._httpError("cctvAccess.startTime must be before endTime.", 400);
    }
    const current = targetClass.cctvAccess && typeof targetClass.cctvAccess.toObject === "function" ? targetClass.cctvAccess.toObject() : (targetClass.cctvAccess || {});
    targetClass.cctvAccess = { ...current, ...cctvAccess };
    await targetClass.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "CLASS_CCTV_TIMING_UPDATED",
      resourceType: "CLASS",
      resourceId: targetClass.classCode,
      reason: "School Admin modified class CCTV schedule",
      ipAddress,
      userAgent,
      metadata: { cctvAccess: targetClass.cctvAccess }
    });

    return targetClass;
  }

  static async _validateTransport({ schoolCode, busCode, routeCode, stopId }) {
    const bCode = busCode ? normalize(busCode) : null;
    const rCode = routeCode ? normalize(routeCode) : null;
    const sId = stopId ? String(stopId).trim() : null;

    let bus = null;
    let route = null;
    let stop = null;

    if (bCode) {
      bus = await Bus.findOne({ schoolCode, busCode: bCode });
      if (!bus) {throw this._httpError(`Bus [${bCode}] not found in this school.`, 404);}
    }
    if (rCode) {
      route = await Route.findOne({ schoolCode, routeCode: rCode });
      if (!route) {throw this._httpError(`Route [${rCode}] not found in this school.`, 404);}
    }
    if (bus && route && bus.routeCode && normalize(bus.routeCode) !== rCode) {
      throw this._httpError(`Bus [${bCode}] is not assigned to route [${rCode}].`, 409);
    }
    if (sId) {
      if (rCode) {
        stop = await Stop.findOne({ schoolCode, routeCode: rCode, stopCode: sId });
        if (!stop) {
          const routeWithStop = await Route.findOne({ schoolCode, routeCode: rCode, "stops.stopId": sId });
          if (!routeWithStop) {throw this._httpError(`Stop [${sId}] does not belong to route [${rCode}] in this school.`, 404);}
        }
      } else {
        stop = await Stop.findOne({ schoolCode, stopCode: sId });
        if (!stop) {
          const routeWithStop = await Route.findOne({ schoolCode, "stops.stopId": sId });
          if (!routeWithStop) {throw this._httpError(`Stop [${sId}] not found in this school.`, 404);}
        }
      }
    }

    return { busCode: bCode, routeCode: rCode, stopId: sId };
  }

  static async enrollStudent({ schoolCode, admissionNumber, fullName, dateOfBirth, gender, classCode, academicYear, busCode, routeCode, stopId, emergencyContacts, adminUser, ipAddress, userAgent }) {
    const adm = String(admissionNumber).trim();
    const existing = await Student.findOne({ schoolCode, admissionNumber: adm });
    if (existing) {throw this._httpError(`Student with admission number [${adm}] already enrolled in this school.`, 409);}

    const targetClass = await this._getClassOrThrow(schoolCode, classCode);
    const transport = await this._validateTransport({ schoolCode, busCode, routeCode, stopId });
    const studentCode = await IdGeneratorService.generateStudentCode(schoolCode);

    const student = await Student.create({
      schoolCode,
      studentCode,
      admissionNumber: adm,
      fullName: String(fullName).trim(),
      dateOfBirth: new Date(dateOfBirth),
      gender,
      classCode: targetClass.classCode,
      section: targetClass.section,
      academicYear: academicYear ? String(academicYear).trim() : targetClass.academicYear,
      busCode: transport.busCode || undefined,
      routeCode: transport.routeCode || undefined,
      stopId: transport.stopId || undefined,
      emergencyContacts: emergencyContacts || []
    });

    await School.updateOne({ schoolCode }, { $inc: { studentCount: 1 } });

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STUDENT_CODE_GENERATED",
      resourceType: "STUDENT",
      resourceId: studentCode,
      reason: "Immutable student identity code generated at enrollment",
      ipAddress,
      userAgent,
      metadata: { admissionNumber: adm }
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STUDENT_ENROLLED",
      resourceType: "STUDENT",
      resourceId: studentCode,
      reason: "New student enrolled by School Admin",
      ipAddress,
      userAgent,
      metadata: { admissionNumber: adm, classCode: targetClass.classCode, academicYear: student.academicYear }
    });

    return student;
  }

  static async listStudents({ schoolCode, classCode, academicYear, status, page = 1, limit = 50 }) {
    const query = { schoolCode };
    if (classCode) {query.classCode = normalize(classCode);}
    if (academicYear) {query.academicYear = String(academicYear).trim();}
    query.status = status ? String(status).toUpperCase() : "ACTIVE";

    const safeLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const safePage = Math.max(parseInt(page, 10) || 1, 1);
    const skip = (safePage - 1) * safeLimit;

    const [students, total] = await Promise.all([
      Student.find(query).sort({ classCode: 1, admissionNumber: 1, fullName: 1 }).skip(skip).limit(safeLimit).lean(),
      Student.countDocuments(query)
    ]);

    return { students, total, page: safePage, limit: safeLimit, totalPages: Math.ceil(total / safeLimit) };
  }

  static async getStudentWithParents({ schoolCode, studentCode }) {
    const student = await this._getStudentOrThrow(schoolCode, studentCode);
    const links = await ParentStudentLink.find({ schoolCode, studentCode: student.studentCode }).sort({ createdAt: -1 }).lean();
    const parentCodes = links.map((l) => l.parentCode).filter(Boolean);
    const parents = await User.find(
      { schoolCode, role: ROLES.PARENT, userCode: { $in: parentCodes } },
      { passwordHash: 0, twoFactor: 0 }
    ).lean();
    const parentMap = new Map(parents.map((p) => [p.userCode, p]));
    const enrichedLinks = links.map((l) => ({ ...l, parent: parentMap.get(l.parentCode) || null }));
    return { student: student.toObject ? student.toObject() : student, links: enrichedLinks };
  }

  static async linkParentToStudent({ schoolCode, studentCode, parentCode, parentUserId, relationship, isPrimaryContact, adminUser, ipAddress, userAgent, reason }) {
    const student = await this._getStudentOrThrow(schoolCode, studentCode);

    const parentQuery = { schoolCode, role: ROLES.PARENT };
    if (parentCode) {parentQuery.userCode = normalize(parentCode);}
    if (parentUserId) {
      if (!mongoose.isValidObjectId(parentUserId)) {throw this._httpError("Invalid parentUserId.", 400);}
      parentQuery._id = parentUserId;
    }

    const parent = await User.findOne(parentQuery);
    if (!parent) {throw this._httpError("Parent user not found in this school.", 404);}
    if (parent.status !== USER_STATUS.ACTIVE) {throw this._httpError("Parent account must be ACTIVE to link.", 409);}
    if (parent.verificationDetails?.status !== PARENT_VERIFICATION_STATUS.VERIFIED) {
      throw this._httpError("Parent must be VERIFIED by School Admin before linking to a student.", 409);
    }

    const existing = await ParentStudentLink.findOne({ schoolCode, parentCode: parent.userCode, studentCode: student.studentCode });
    if (existing) {
      throw this._httpError("This parent is already linked to the student.", 409);
    }

    if (isPrimaryContact) {
      await ParentStudentLink.updateMany(
        { schoolCode, studentCode: student.studentCode, isPrimaryContact: true },
        { $set: { isPrimaryContact: false } }
      );
    } else {
      const primaryExists = await ParentStudentLink.exists({ schoolCode, studentCode: student.studentCode, isPrimaryContact: true, status: PARENT_VERIFICATION_STATUS.VERIFIED });
      if (!primaryExists) {
        // ensure at least one primary contact if none exists
        isPrimaryContact = true;
      }
    }

    const link = await ParentStudentLink.create({
      schoolCode,
      parentCode: parent.userCode,
      studentCode: student.studentCode,
      relationship,
      isPrimaryContact: !!isPrimaryContact,
      status: PARENT_VERIFICATION_STATUS.VERIFIED,
      verifiedBy: adminUser.userCode,
      verifiedAt: new Date()
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "PARENT_STUDENT_LINKED",
      resourceType: "PARENT_STUDENT_LINK",
      resourceId: asId(link._id),
      reason: reason || "School Admin linked verified parent to student",
      ipAddress,
      userAgent,
      metadata: { parentCode: parent.userCode, studentCode: student.studentCode, relationship, isPrimaryContact: link.isPrimaryContact }
    });

    return { link, parent: { userCode: parent.userCode, fullName: parent.fullName, email: parent.email, phone: parent.phone, status: parent.status } };
  }

  static async assignStudentToClass({ schoolCode, studentCode, classCode, academicYear, adminUser, ipAddress, userAgent, reason }) {
    const student = await this._getStudentOrThrow(schoolCode, studentCode);
    const targetClass = await this._getClassOrThrow(schoolCode, classCode);
    const prev = { classCode: student.classCode, section: student.section, academicYear: student.academicYear };

    student.classCode = targetClass.classCode;
    student.section = targetClass.section;
    student.academicYear = academicYear ? String(academicYear).trim() : targetClass.academicYear;
    await student.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STUDENT_CLASS_ASSIGNED",
      resourceType: "STUDENT",
      resourceId: student.studentCode,
      reason: reason || "School Admin assigned/transferred student class",
      ipAddress,
      userAgent,
      metadata: { previous: prev, next: { classCode: student.classCode, section: student.section, academicYear: student.academicYear } }
    });

    return student;
  }

  static async updateStudentTransport({ schoolCode, studentCode, busCode, routeCode, stopId, adminUser, ipAddress, userAgent, reason }) {
    const student = await this._getStudentOrThrow(schoolCode, studentCode);
    const prev = { busCode: student.busCode || null, routeCode: student.routeCode || null, stopId: student.stopId || null };

    const resolvedBus = busCode === "" ? null : (busCode !== undefined ? normalize(busCode) : (student.busCode ? normalize(student.busCode) : null));
    const resolvedRoute = routeCode === "" ? null : (routeCode !== undefined ? normalize(routeCode) : (student.routeCode ? normalize(student.routeCode) : null));
    const resolvedStop = stopId === "" ? null : (stopId !== undefined ? String(stopId).trim() : (student.stopId || null));

    // Validate when setting any value (or when keeping existing with new related field)
    if (resolvedBus || resolvedRoute || resolvedStop) {
      await this._validateTransport({ schoolCode, busCode: resolvedBus, routeCode: resolvedRoute, stopId: resolvedStop });
    }

    student.busCode = resolvedBus || undefined;
    student.routeCode = resolvedRoute || undefined;
    student.stopId = resolvedStop || undefined;
    await student.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STUDENT_TRANSPORT_UPDATED",
      resourceType: "STUDENT",
      resourceId: student.studentCode,
      reason: reason || "School Admin updated student transport assignment",
      ipAddress,
      userAgent,
      metadata: { previous: prev, next: { busCode: student.busCode || null, routeCode: student.routeCode || null, stopId: student.stopId || null } }
    });

    return student;
  }

  static async listStudentParentLinks({ schoolCode, studentCode }) {
    const result = await this.getStudentWithParents({ schoolCode, studentCode });
    return { student: result.student, links: result.links };
  }

  static async getMyChildren({ schoolCode, parentUser }) {
    const { ParentStudentLink, Student, User } = require("../models");
    const userDoc = await User.findOne({ schoolCode, userCode: parentUser.userCode });

    let links = await ParentStudentLink.find({
      schoolCode,
      $or: [
        { parentCode: parentUser.userCode },
        { parentUserId: parentUser._id },
        ...(userDoc ? [{ parentUserId: userDoc._id }] : [])
      ]
    });

    let studentCodes = links.map((l) => l.studentCode);

    // Fallback: Check parentDetails on user or find mapped student
    if (studentCodes.length === 0 && userDoc) {
      let matchedStudent = null;
      if (userDoc.parentDetails?.studentAdmissionNumber) {
        matchedStudent = await Student.findOne({
          schoolCode,
          admissionNumber: userDoc.parentDetails.studentAdmissionNumber
        });
      }
      if (!matchedStudent && userDoc.parentDetails?.studentCode) {
        matchedStudent = await Student.findOne({
          schoolCode,
          studentCode: userDoc.parentDetails.studentCode
        });
      }
      if (!matchedStudent && userDoc.phone) {
        matchedStudent = await Student.findOne({
          schoolCode,
          "primaryContact.phone": userDoc.phone
        });
      }
      if (!matchedStudent) {
        // Fallback to any student in this tenant if enrolled
        matchedStudent = await Student.findOne({ schoolCode, status: "ACTIVE" });
      }

      if (matchedStudent) {
        studentCodes = [matchedStudent.studentCode];
        await ParentStudentLink.findOneAndUpdate(
          { schoolCode, parentCode: parentUser.userCode, studentCode: matchedStudent.studentCode },
          {
            schoolCode,
            parentCode: parentUser.userCode,
            parentUserId: userDoc._id,
            studentCode: matchedStudent.studentCode,
            studentId: matchedStudent._id,
            relationship: userDoc.parentDetails?.relationship || "PARENT",
            isPrimaryContact: true,
            status: "VERIFIED",
            verifiedAt: new Date()
          },
          { upsert: true, new: true }
        );
      }
    }

    const students = await Student.find({
      schoolCode,
      studentCode: { $in: studentCodes }
    });

    return { students, count: students.length };
  }
}

module.exports = ClassStudentService;
