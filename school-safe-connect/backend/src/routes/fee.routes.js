/**
 * Fee Management Routes
 */

const express = require("express");
const FeeController = require("../controllers/fee.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

const schoolAdminOnly = authorizeRoles(ROLES.SCHOOL_ADMIN);
const feeViewers = authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.PARENT);

router.get("/", feeViewers, FeeController.listFees);
router.get("/stats", schoolAdminOnly, FeeController.getStats);
router.post("/", schoolAdminOnly, FeeController.createFee);
router.post("/:id/pay", schoolAdminOnly, FeeController.recordPayment);
router.post("/:id/remind-whatsapp", schoolAdminOnly, FeeController.remindWhatsApp);
router.post("/remind-all-whatsapp", schoolAdminOnly, FeeController.remindAllWhatsApp);

module.exports = router;
