/**
 * Emergency Panic / SOS Routes
 */

const express = require("express");
const IncidentPanicController = require("../controllers/incidentPanic.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, requireActiveStatus } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");
const {
  validate,
  triggerPanicSchema,
  updatePanicStatusSchema,
  panicQuerySchema
} = require("../validators/incidentPanic.validator");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

// Trigger SOS Panic Alert (Parents, Teachers, School Admin, Transport Coordinator, Drivers)
// Explicit client confirmation (confirmed: true), rate limit and cooldown enforced in service.
router.post(
  "/trigger",
  requireActiveStatus,
  authorizeRoles(
    ROLES.PARENT,
    ROLES.CLASS_TEACHER,
    ROLES.SUBJECT_TEACHER,
    ROLES.SCHOOL_ADMIN,
    ROLES.TRANSPORT_COORDINATOR,
    ROLES.DRIVER
  ),
  validate(triggerPanicSchema),
  IncidentPanicController.triggerSOS
);

// List active/past panic alerts with pagination and filters (School Admin, Transport Coordinator)
router.get(
  "/",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(panicQuerySchema, "query"),
  IncidentPanicController.listPanicAlerts
);

// List own triggered panic alerts (any authenticated tenant user, tenant-scoped)
router.get(
  "/mine",
  validate(panicQuerySchema, "query"),
  IncidentPanicController.listMyPanicAlerts
);

// Acknowledge / Resolve / False-alarm Panic Alert (School Admin, Transport Coordinator)
router.put(
  "/:alertCode/status",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(updatePanicStatusSchema),
  IncidentPanicController.updatePanicStatus
);

module.exports = router;
