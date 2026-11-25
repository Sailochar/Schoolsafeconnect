/**
 * Class Management Routes
 */

const express = require("express");
const ClassStudentController = require("../controllers/classStudent.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

const schoolAdminOnly = authorizeRoles(ROLES.SCHOOL_ADMIN);
const classReaders = authorizeRoles(
  ROLES.SCHOOL_ADMIN,
  ROLES.CLASS_TEACHER,
  ROLES.SUBJECT_TEACHER,
  ROLES.TRANSPORT_COORDINATOR
);

// Read classes (tenant-scoped)
router.get("/", classReaders, ClassStudentController.listClasses);

// Manage classes (School Admin only)
router.post("/", schoolAdminOnly, ClassStudentController.createClass);
router.post("/:classCode/assign-teacher", schoolAdminOnly, ClassStudentController.assignTeacher);
router.put("/:classCode/cctv-timing", schoolAdminOnly, ClassStudentController.updateCctvTiming);

module.exports = router;
