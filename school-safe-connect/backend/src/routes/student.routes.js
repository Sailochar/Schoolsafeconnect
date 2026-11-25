/**
 * Student Management Routes
 */

const express = require("express");
const ClassStudentController = require("../controllers/classStudent.controller");
const AssessmentController = require("../controllers/assessment.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

const schoolAdminOnly = authorizeRoles(ROLES.SCHOOL_ADMIN);
const studentReaders = authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.TRANSPORT_COORDINATOR);
const parentReaders = authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER);

// Parent child retrieval
router.get("/my-children", authorizeRoles(ROLES.PARENT), ClassStudentController.getMyChildren);
router.get("/:studentCode/report-card", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.PARENT), AssessmentController.getStudentReportCard);

// Read & Export students
router.get("/export", schoolAdminOnly, ClassStudentController.exportStudents);
router.get("/", studentReaders, ClassStudentController.listStudents);
router.get("/:studentCode/parents", parentReaders, ClassStudentController.getStudentParents);

// School Admin management
router.post("/bulk-import", schoolAdminOnly, ClassStudentController.bulkImportStudents);
router.post("/", schoolAdminOnly, ClassStudentController.enrollStudent);
router.post("/:studentCode/parents", schoolAdminOnly, ClassStudentController.linkParent);
router.put("/:studentCode/class", schoolAdminOnly, ClassStudentController.assignStudentClass);
router.put("/:studentCode/transport", schoolAdminOnly, ClassStudentController.updateStudentTransport);
router.put("/:studentCode", schoolAdminOnly, ClassStudentController.modifyStudent);
router.post("/:studentCode/transfer", schoolAdminOnly, ClassStudentController.transferStudent);

module.exports = router;
