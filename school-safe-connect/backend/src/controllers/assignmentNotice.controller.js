/**
 * Assignment and Notice Controller
 */

const fs = require("fs");
const path = require("path");
const AssignmentNoticeService = require("../services/assignmentNotice.service");
const { sendSuccess, sendCreated } = require("../utils/response");
const {
  createAssignmentSchema,
  updateAssignmentSchema,
  markViewedSchema,
  publishNoticeSchema,
  updateNoticeSchema,
  submitQuerySchema,
  replyQuerySchema
} = require("../validators/assignmentNotice.validator");

function validate(schema, payload) {
  const { value, error } = schema.validate(payload, { abortEarly: false, stripUnknown: true });
  if (error) {
    const details = error.details.map((d) => d.message).join("; ");
    const err = new Error(details);
    err.statusCode = 400;
    throw err;
  }
  return value;
}

class AssignmentNoticeController {
  static async listAssignments(req, res, next) {
    try {
      const assignments = await AssignmentNoticeService.listAssignmentsForUser({
        schoolCode: req.tenantSchoolCode,
        user: req.user,
        classCode: req.query.classCode ? String(req.query.classCode).toUpperCase() : undefined
      });
      return sendSuccess(res, "Assignments retrieved.", { assignments, count: assignments.length });
    } catch (err) {
      next(err);
    }
  }

  static async listMyClasses(req, res, next) {
    try {
      const classes = await AssignmentNoticeService.listMyClasses({
        schoolCode: req.tenantSchoolCode,
        teacherUser: req.user
      });
      return sendSuccess(res, "Assigned classes retrieved.", { classes, count: classes.length });
    } catch (err) {
      next(err);
    }
  }

  static async uploadAttachment(req, res, next) {
    try {
      const { fileName, fileBase64, fileType, docFormat } = req.body || {};
      if (!fileName || !fileBase64) {
        const err = new Error("fileName and fileBase64 are required.");
        err.statusCode = 400;
        throw err;
      }
      let cleanName = String(fileName).replace(/[^a-zA-Z0-9._-]/g, "_");
      const ext = path.extname(cleanName).toLowerCase();

      // Ensure proper extension if format was explicitly chosen
      if (!ext) {
        if (docFormat === "PDF") cleanName += ".pdf";
        else if (docFormat === "DOC") cleanName += ".docx";
        else cleanName += ".txt";
      }

      let resolvedMime = fileType || "application/octet-stream";
      if (cleanName.endsWith(".pdf") || fileType === "application/pdf") {
        resolvedMime = "application/pdf";
      } else if (cleanName.endsWith(".docx") || String(fileType).includes("wordprocessingml")) {
        resolvedMime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (cleanName.endsWith(".doc") || String(fileType).includes("msword")) {
        resolvedMime = "application/msword";
      } else if (cleanName.endsWith(".txt") || fileType === "text/plain") {
        resolvedMime = "text/plain";
      }

      const uploadsDir = path.resolve(__dirname, "../../uploads/assignments");
      fs.mkdirSync(uploadsDir, { recursive: true });
      const uniqueName = `${Date.now()}_${cleanName}`;
      const base64Data = String(fileBase64).replace(/^data:[^;]+;base64,/, "");
      const buffer = Buffer.from(base64Data, "base64");
      fs.writeFileSync(path.join(uploadsDir, uniqueName), buffer);

      const baseUrl = `${req.protocol}://${req.get("host")}`;
      return sendCreated(res, "Attachment uploaded.", {
        fileName: cleanName,
        fileUrl: `${baseUrl}/uploads/assignments/${uniqueName}`,
        fileKey: `assignments/${uniqueName}`,
        fileType: resolvedMime,
        fileSize: buffer.length,
        isPdf: resolvedMime === "application/pdf",
        isDoc: resolvedMime.includes("word") || resolvedMime.includes("msword"),
        isText: resolvedMime === "text/plain"
      });
    } catch (err) {
      next(err);
    }
  }

  static async createAssignment(req, res, next) {
    try {
      const body = validate(createAssignmentSchema, req.body);
      const assignment = await AssignmentNoticeService.createAssignment({
        schoolCode: req.tenantSchoolCode,
        teacherUser: req.user,
        ...body,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendCreated(res, "Assignment created.", { assignment });
    } catch (err) {
      next(err);
    }
  }

  static async updateAssignment(req, res, next) {
    try {
      const updates = validate(updateAssignmentSchema, req.body);
      const assignment = await AssignmentNoticeService.updateAssignment({
        schoolCode: req.tenantSchoolCode,
        actorUser: req.user,
        assignmentCode: req.params.assignmentCode,
        updates,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendSuccess(res, "Assignment updated.", { assignment });
    } catch (err) {
      next(err);
    }
  }

  static async getAssignment(req, res, next) {
    try {
      const assignment = await AssignmentNoticeService.getAssignmentDetail({
        schoolCode: req.tenantSchoolCode,
        user: req.user,
        assignmentCode: req.params.assignmentCode
      });
      return sendSuccess(res, "Assignment retrieved.", { assignment });
    } catch (err) {
      next(err);
    }
  }

  static async listClassAssignments(req, res, next) {
    try {
      const includeDraft = String(req.query.includeDraft || "").toLowerCase() === "true";
      const assignments = await AssignmentNoticeService.listAssignmentsForClass({
        schoolCode: req.tenantSchoolCode,
        user: req.user,
        classCode: req.params.classCode,
        includeDraft
      });
      return sendSuccess(res, "Class assignments retrieved.", { assignments, count: assignments.length });
    } catch (err) {
      next(err);
    }
  }

  static async listParentAssignments(req, res, next) {
    try {
      const assignments = await AssignmentNoticeService.listAssignmentsForParent({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        studentCode: req.params.studentCode
      });
      return sendSuccess(res, "Student assignments retrieved.", { assignments, count: assignments.length });
    } catch (err) {
      next(err);
    }
  }

  static async markViewed(req, res, next) {
    try {
      const body = validate(markViewedSchema, req.body);
      const record = await AssignmentNoticeService.markAssignmentViewed({
        schoolCode: req.tenantSchoolCode,
        assignmentCode: req.params.assignmentCode,
        studentCode: body.studentCode,
        parentUser: req.user,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendSuccess(res, "Assignment marked as viewed.", { submission: record });
    } catch (err) {
      next(err);
    }
  }

  static async publishNotice(req, res, next) {
    try {
      const body = validate(publishNoticeSchema, req.body);
      const notice = await AssignmentNoticeService.publishNotice({
        schoolCode: req.tenantSchoolCode,
        publisherUser: req.user,
        ...body,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendCreated(res, "Notice published.", { notice });
    } catch (err) {
      next(err);
    }
  }

  static async updateNotice(req, res, next) {
    try {
      const updates = validate(updateNoticeSchema, req.body);
      const notice = await AssignmentNoticeService.updateNotice({
        schoolCode: req.tenantSchoolCode,
        actorUser: req.user,
        noticeCode: req.params.noticeCode,
        updates,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendSuccess(res, "Notice updated.", { notice });
    } catch (err) {
      next(err);
    }
  }

  static async listNotices(req, res, next) {
    try {
      const notices = await AssignmentNoticeService.listNoticesForUser({
        schoolCode: req.tenantSchoolCode,
        user: req.user
      });
      return sendSuccess(res, "Notices retrieved.", { notices, count: notices.length });
    } catch (err) {
      next(err);
    }
  }

  static async submitQuery(req, res, next) {
    try {
      const body = validate(submitQuerySchema, req.body);
      const result = await AssignmentNoticeService.handleParentQuery({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        ...body,
        message: body.message || body.question,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendCreated(res, "Query submitted.", result);
    } catch (err) {
      next(err);
    }
  }

  static async escalateQuery(req, res, next) {
    try {
      const query = await AssignmentNoticeService.escalateQueryToSchoolAdmin({
        schoolCode: req.tenantSchoolCode,
        queryCode: req.params.queryCode,
        parentUser: req.user,
        reason: req.body?.reason,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendSuccess(res, "Safety concern escalated to School Admin.", { query });
    } catch (err) {
      next(err);
    }
  }

  static async listMyQueries(req, res, next) {
    try {
      const queries = await AssignmentNoticeService.listParentQueries({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        studentCode: req.query.studentCode ? String(req.query.studentCode).toUpperCase() : undefined
      });
      return sendSuccess(res, "Parent queries retrieved.", { queries, count: queries.length });
    } catch (err) {
      next(err);
    }
  }

  static async listTeacherQueries(req, res, next) {
    try {
      const queries = await AssignmentNoticeService.listTeacherQueries({
        schoolCode: req.tenantSchoolCode,
        teacherUser: req.user,
        status: req.query.status ? String(req.query.status).toUpperCase() : undefined
      });
      return sendSuccess(res, "Teacher queries retrieved.", { queries, count: queries.length });
    } catch (err) {
      next(err);
    }
  }

  static async replyToQuery(req, res, next) {
    try {
      const body = validate(replyQuerySchema, req.body);
      const query = await AssignmentNoticeService.replyToParentQuery({
        schoolCode: req.tenantSchoolCode,
        teacherUser: req.user,
        queryCode: req.params.queryCode,
        ...body,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendSuccess(res, "Query replied.", { query });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AssignmentNoticeController;
