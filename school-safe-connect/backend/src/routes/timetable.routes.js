/**
 * Timetable Routes
 */

const express = require("express");
const TimetableController = require("../controllers/timetable.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, requireActiveStatus } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);
router.use(requireActiveStatus);

// Teacher / Parent personal timetable + live CCTV window status
router.get(
  "/my-schedule",
  authorizeRoles(ROLES.PARENT, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.SCHOOL_ADMIN),
  TimetableController.getMySchedule
);

// Class-wise timetable retrieval
router.get(
  "/class/:classCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.PARENT),
  TimetableController.getClassTimetable
);

// School Admin timetable creation & auto-generation
router.post(
  "/class/:classCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN),
  TimetableController.saveClassDayTimetable
);
router.post(
  "/class/:classCode/generate",
  authorizeRoles(ROLES.SCHOOL_ADMIN),
  TimetableController.generateWeeklyTimetable
);

module.exports = router;
