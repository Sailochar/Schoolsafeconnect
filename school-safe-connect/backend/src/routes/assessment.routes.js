/**
 * Assessment & OMR Evaluation Routes
 */

const express = require("express");
const AssessmentController = require("../controllers/assessment.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

// Apply authentication and tenant isolation to all routes
router.use(authenticate, tenantGuard);

// Assessment operations
router.post(
  "/",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.GLOBAL_SUPER_ADMIN),
  AssessmentController.createAssessment
);

router.get("/", AssessmentController.listAssessments);
router.get("/:id", AssessmentController.getAssessment);

router.post(
  "/:id/evaluate-omr",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.GLOBAL_SUPER_ADMIN),
  AssessmentController.evaluateOmr
);

router.post(
  "/:id/publish-report-cards",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.GLOBAL_SUPER_ADMIN),
  AssessmentController.publishReportCards
);

router.get("/:id/export-excel", AssessmentController.exportExcel);

// Report card lookups
router.get("/student/:studentCode/report-card", AssessmentController.getStudentReportCard);
router.get("/class/:classCode/report-cards", AssessmentController.getClassReportCards);

module.exports = router;
