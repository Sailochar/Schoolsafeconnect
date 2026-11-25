/**
 * Assignment Routes
 */

const express = require("express");
const AssignmentNoticeController = require("../controllers/assignmentNotice.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, requireActiveStatus, requireVerifiedParent } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);
router.use(requireActiveStatus);

// Assignment CRUD & delivery
router.get("/", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.PARENT), AssignmentNoticeController.listAssignments);
router.get("/my-classes", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.listMyClasses);
router.post("/upload", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.uploadAttachment);
router.post("/", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.createAssignment);
router.get("/class/:classCode", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.PARENT), AssignmentNoticeController.listClassAssignments);
router.get("/parent/student/:studentCode", authorizeRoles(ROLES.PARENT), requireVerifiedParent, AssignmentNoticeController.listParentAssignments);

// Parent queries (communication) - placed before /:assignmentCode
router.post("/queries", authorizeRoles(ROLES.PARENT), requireVerifiedParent, AssignmentNoticeController.submitQuery);
router.get("/queries/my", authorizeRoles(ROLES.PARENT), requireVerifiedParent, AssignmentNoticeController.listMyQueries);
router.get("/queries/teacher", authorizeRoles(ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.SCHOOL_ADMIN), AssignmentNoticeController.listTeacherQueries);
router.post("/queries/:queryCode/reply", authorizeRoles(ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.SCHOOL_ADMIN), AssignmentNoticeController.replyToQuery);
router.post("/queries/:queryCode/escalate", authorizeRoles(ROLES.PARENT), requireVerifiedParent, AssignmentNoticeController.escalateQuery);

// Backward-compatible alias
router.post("/query", authorizeRoles(ROLES.PARENT), requireVerifiedParent, AssignmentNoticeController.submitQuery);

router.get("/:assignmentCode", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.PARENT), AssignmentNoticeController.getAssignment);
router.put("/:assignmentCode", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.updateAssignment);
router.patch("/:assignmentCode", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.updateAssignment);
router.post("/:assignmentCode/viewed", authorizeRoles(ROLES.PARENT), requireVerifiedParent, AssignmentNoticeController.markViewed);

module.exports = router;
