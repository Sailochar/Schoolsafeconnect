/**
 * Class and Student Controller
 */

const ClassStudentService = require("../services/classStudent.service");
const StudentManagementService = require("../services/studentManagement.service");
const {
  createClassSchema,
  assignTeacherSchema,
  updateCctvTimingSchema,
  enrollStudentSchema,
  studentCodeParamSchema,
  linkParentSchema,
  assignStudentClassSchema,
  updateStudentTransportSchema
} = require("../validators/classStudent.validator");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class ClassStudentController {
  static _ctx(req) {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"] || "unknown"
    };
  }

  static async createClass(req, res, next) {
    try {
      const { error, value } = createClassSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const newClass = await ClassStudentService.createClass({
        schoolCode: req.tenantSchoolCode,
        ...value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendCreated(res, "Class created successfully.", newClass);
    } catch (err) {
      next(err);
    }
  }

  static async listClasses(req, res, next) {
    try {
      const classes = await ClassStudentService.listClasses(req.tenantSchoolCode, {
        academicYear: req.query.academicYear,
        status: req.query.status
      });
      return sendSuccess(res, "Classes retrieved.", { classes, count: classes.length });
    } catch (err) {
      next(err);
    }
  }

  static async assignTeacher(req, res, next) {
    try {
      const { error, value } = assignTeacherSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const assignment = await ClassStudentService.assignTeacherToClass({
        schoolCode: req.tenantSchoolCode,
        classCode: req.params.classCode,
        ...value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Teacher assigned to class successfully.", assignment);
    } catch (err) {
      next(err);
    }
  }

  static async updateCctvTiming(req, res, next) {
    try {
      const { error, value } = updateCctvTimingSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const updatedClass = await ClassStudentService.updateClassCctvTiming({
        schoolCode: req.tenantSchoolCode,
        classCode: req.params.classCode,
        cctvAccess: value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Class CCTV timing configuration updated.", updatedClass);
    } catch (err) {
      next(err);
    }
  }

  static async enrollStudent(req, res, next) {
    try {
      const { error, value } = enrollStudentSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const student = await ClassStudentService.enrollStudent({
        schoolCode: req.tenantSchoolCode,
        ...value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendCreated(res, "Student enrolled successfully.", student);
    } catch (err) {
      next(err);
    }
  }

  static async listStudents(req, res, next) {
    try {
      const { classCode, academicYear, status, page, limit } = req.query;
      const result = await ClassStudentService.listStudents({
        schoolCode: req.tenantSchoolCode,
        classCode,
        academicYear,
        status,
        page,
        limit
      });
      return sendSuccess(res, "Students retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async getMyChildren(req, res, next) {
    try {
      const result = await ClassStudentService.getMyChildren({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user
      });
      return sendSuccess(res, "Children retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async getStudentParents(req, res, next) {
    try {
      const { error } = studentCodeParamSchema.validate(req.params);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const result = await ClassStudentService.getStudentWithParents({
        schoolCode: req.tenantSchoolCode,
        studentCode: req.params.studentCode
      });
      return sendSuccess(res, "Student and parent links retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async linkParent(req, res, next) {
    try {
      const { error: pErr } = studentCodeParamSchema.validate(req.params);
      if (pErr) {return sendError(res, pErr.details[0].message, 400);}
      const { error, value } = linkParentSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const result = await ClassStudentService.linkParentToStudent({
        schoolCode: req.tenantSchoolCode,
        studentCode: req.params.studentCode,
        ...value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendCreated(res, "Parent linked to student successfully.", result);
    } catch (err) {
      next(err);
    }
  }

  static async assignStudentClass(req, res, next) {
    try {
      const { error: pErr } = studentCodeParamSchema.validate(req.params);
      if (pErr) {return sendError(res, pErr.details[0].message, 400);}
      const { error, value } = assignStudentClassSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const student = await ClassStudentService.assignStudentToClass({
        schoolCode: req.tenantSchoolCode,
        studentCode: req.params.studentCode,
        ...value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Student class assignment updated.", student);
    } catch (err) {
      next(err);
    }
  }

  static async updateStudentTransport(req, res, next) {
    try {
      const { error: pErr } = studentCodeParamSchema.validate(req.params);
      if (pErr) {return sendError(res, pErr.details[0].message, 400);}
      const { error, value } = updateStudentTransportSchema.validate(req.body);
      if (error) {return sendError(res, error.details[0].message, 400);}
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const student = await ClassStudentService.updateStudentTransport({
        schoolCode: req.tenantSchoolCode,
        studentCode: req.params.studentCode,
        ...value,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Student transport assignment updated.", student);
    } catch (err) {
      next(err);
    }
  }

  static async modifyStudent(req, res, next) {
    try {
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const student = await StudentManagementService.modifyStudent({
        schoolCode: req.tenantSchoolCode,
        studentCode: req.params.studentCode,
        updateData: req.body,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Student details modified successfully.", student);
    } catch (err) {
      next(err);
    }
  }

  static async transferStudent(req, res, next) {
    try {
      const { targetClassCode, targetSection, targetAcademicYear, reason } = req.body;
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const result = await StudentManagementService.transferStudentClass({
        schoolCode: req.tenantSchoolCode,
        studentCode: req.params.studentCode,
        targetClassCode,
        targetSection,
        targetAcademicYear,
        reason,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Student transferred to new class successfully.", result);
    } catch (err) {
      next(err);
    }
  }

  static async bulkImportStudents(req, res, next) {
    try {
      const { students } = req.body;
      const { ipAddress, userAgent } = ClassStudentController._ctx(req);
      const result = await StudentManagementService.bulkImportStudents({
        schoolCode: req.tenantSchoolCode,
        studentsData: students,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, `Bulk import finished: ${result.importedCount} added, ${result.skippedCount} skipped.`, result);
    } catch (err) {
      next(err);
    }
  }

  static async exportStudents(req, res, next) {
    try {
      const { classCode } = req.query;
      const data = await StudentManagementService.exportStudents({
        schoolCode: req.tenantSchoolCode,
        classCode
      });
      return sendSuccess(res, "Students exported successfully.", { students: data, count: data.length });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ClassStudentController;
