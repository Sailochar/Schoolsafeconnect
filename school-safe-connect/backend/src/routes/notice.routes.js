/**
 * Notice & Communication Routes
 */

const express = require("express");
const AssignmentNoticeController = require("../controllers/assignmentNotice.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, requireActiveStatus } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);
router.use(requireActiveStatus);

// Publish/update/list notices
router.post("/", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.publishNotice);
router.get("/", AssignmentNoticeController.listNotices);
router.put("/:noticeCode", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.updateNotice);
router.patch("/:noticeCode", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER), AssignmentNoticeController.updateNotice);

module.exports = router;
