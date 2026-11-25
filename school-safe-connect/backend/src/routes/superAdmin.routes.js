/**
 * Super Admin Routes
 * Protected strictly for GLOBAL_SUPER_ADMIN identity and Web Client Platform.
 */

const express = require("express");
const SuperAdminController = require("../controllers/superAdmin.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const { authorizeRoles, enforceWebClientOnly } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

// Strict Super Admin and Web Application protection
router.use(authenticate);
router.use(enforceWebClientOnly);
router.use(authorizeRoles(ROLES.GLOBAL_SUPER_ADMIN));

// Onboarding requests management
router.get("/onboarding-requests", SuperAdminController.listOnboardingRequests);
router.post("/schools/approve", SuperAdminController.approveSchool);
router.post("/schools/reject", SuperAdminController.rejectSchool);
router.put("/onboarding-requests/:requestId", SuperAdminController.updateOnboardingRequest);
router.delete("/onboarding-requests/:requestId", SuperAdminController.deleteOnboardingRequest);

// School tenant management
router.get("/schools", SuperAdminController.listSchools);
router.get("/schools/:schoolCode/overview", SuperAdminController.getSchoolFullOverview);
router.put("/schools/:schoolCode/suspend", SuperAdminController.suspendSchool);
router.put("/schools/:schoolCode/activate", SuperAdminController.activateSchool);
router.delete("/schools/:schoolCode", SuperAdminController.deleteSchool);

// Section 20 Destructive Admin removal
router.post("/schools/:schoolCode/admins/:adminUserCode/remove", SuperAdminController.removeAdmin);

// Audit ledger review
router.get("/audit-logs", SuperAdminController.getAuditLogs);

module.exports = router;
