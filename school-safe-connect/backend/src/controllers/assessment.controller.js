/**
 * Assessment & OMR Evaluation Controller
 */

const OmrEvaluationService = require("../services/omrEvaluation.service");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class AssessmentController {
  /**
   * POST /api/v1/assessments
   * Create a new assessment with answer key
   */
  static async createAssessment(req, res, next) {
    try {
      const {
        classCode,
        title,
        assessmentType,
        subject,
        academicYear,
        totalQuestions,
        marksPerQuestion,
        negativeMarking,
        answerKey
      } = req.body;

      const schoolCode = req.user.schoolCode;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const assessment = await OmrEvaluationService.createAssessment({
        schoolCode,
        classCode,
        title,
        assessmentType,
        subject,
        academicYear,
        totalQuestions,
        marksPerQuestion,
        negativeMarking,
        answerKey,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Assessment created successfully with answer key.", assessment);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assessments
   * List assessments for school tenant
   */
  static async listAssessments(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const { classCode, assessmentType, subject } = req.query;

      const assessments = await OmrEvaluationService.listAssessments({
        schoolCode,
        classCode,
        assessmentType,
        subject
      });

      return sendSuccess(res, "Assessments retrieved successfully.", assessments);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assessments/:id
   * Get single assessment with detailed student evaluation breakdown
   */
  static async getAssessment(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const assessmentId = req.params.id;

      const assessment = await OmrEvaluationService.getAssessmentById({
        schoolCode,
        assessmentId
      });

      return sendSuccess(res, "Assessment details retrieved successfully.", assessment);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/assessments/:id/evaluate-omr
   * Run AI OMR evaluation across student sheets
   */
  static async evaluateOmr(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const assessmentId = req.params.id;
      const { omrSheets, autoMatchAllStudents } = req.body;

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const evaluated = await OmrEvaluationService.evaluateOmrBatch({
        schoolCode,
        assessmentId,
        omrSheets: omrSheets || [],
        autoMatchAllStudents: autoMatchAllStudents !== false,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "AI OMR evaluation completed successfully.", evaluated);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/assessments/:id/publish-report-cards
   * Save evaluated results into student report cards & dispatch WhatsApp alerts
   */
  static async publishReportCards(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const assessmentId = req.params.id;
      const { notifyWhatsApp = true } = req.body;

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const outcome = await OmrEvaluationService.publishResultsToReportCards({
        schoolCode,
        assessmentId,
        notifyWhatsApp,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(
        res,
        `Results published! Updated ${outcome.reportCardsUpdated} report cards and dispatched ${outcome.whatsappDispatchedCount} WhatsApp notifications.`,
        outcome
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assessments/:id/export-excel
   * Download assessment results as Excel (.xlsx) spreadsheet
   */
  static async exportExcel(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const assessmentId = req.params.id;

      const { buffer, filename } = await OmrEvaluationService.exportResultsToExcel({
        schoolCode,
        assessmentId
      });

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
      return res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assessments/student/:studentCode/report-card
   * Get student's complete Report Card across all assessments
   */
  static async getStudentReportCard(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const studentCode = req.params.studentCode;
      const { academicYear } = req.query;

      const reportCard = await OmrEvaluationService.getStudentReportCard({
        schoolCode,
        studentCode,
        academicYear
      });

      return sendSuccess(res, "Student report card retrieved.", reportCard);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/assessments/class/:classCode/report-cards
   * Get all report cards in a class
   */
  static async getClassReportCards(req, res, next) {
    try {
      const schoolCode = req.user.schoolCode;
      const classCode = req.params.classCode;
      const { academicYear } = req.query;

      const cards = await OmrEvaluationService.getClassReportCards({
        schoolCode,
        classCode,
        academicYear
      });

      return sendSuccess(res, "Class report cards retrieved.", cards);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AssessmentController;
