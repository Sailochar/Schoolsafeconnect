/**
 * School Admin Routes
 * Protected strictly for SCHOOL_ADMIN identity on the WEB platform client.
 * All endpoints are tenant-scoped via req.tenantSchoolCode (derived from JWT,
 * never from client payloads).
 */

const express = require("express");
const SchoolAdminController = require("../controllers/schoolAdmin.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, enforceWebClientOnly } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);
router.use(enforceWebClientOnly);
router.use(authorizeRoles(ROLES.SCHOOL_ADMIN));

// User approval endpoints
router.get("/pending-approvals", SchoolAdminController.listPending);
router.post("/users/teachers/approve", SchoolAdminController.approveTeacher);
router.post("/users/drivers/approve", SchoolAdminController.approveDriver);
router.post("/users/transport-coordinators/approve", SchoolAdminController.approveTransportCoordinator);
router.post("/users/parents/verify-and-approve", SchoolAdminController.verifyParent);
router.post("/users/parents/link-student", SchoolAdminController.linkStudent);
router.post("/users/reject", SchoolAdminController.rejectUser);

// Parent-student link management
router.get("/users/parents/:parentCode/links", SchoolAdminController.listParentLinks);

// User status and modification management
router.get("/users", SchoolAdminController.listUsers);
router.put("/users/:userCode", SchoolAdminController.modifyUser);
router.put("/users/:userCode/suspend", SchoolAdminController.suspendUser);
router.put("/users/:userCode/activate", SchoolAdminController.activateUser);

// Daily Teacher Assignment Management
router.get("/daily-teacher-assignment", SchoolAdminController.getDailyAssignments);
router.post("/daily-teacher-assignment", SchoolAdminController.saveDailyAssignments);

// School WhatsApp Connection
router.get("/whatsapp", SchoolAdminController.getWhatsAppConfig);
router.post("/whatsapp/connect", SchoolAdminController.updateWhatsAppConfig);
router.post("/whatsapp/test-connection", SchoolAdminController.testWhatsAppConnection);
router.post("/whatsapp/broadcast", SchoolAdminController.sendWhatsAppBroadcast);

module.exports = router;
