/**
 * Incident Routes
 */

const express = require("express");
const IncidentPanicController = require("../controllers/incidentPanic.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, requireActiveStatus } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");
const {
  validate,
  createIncidentSchema,
  updateIncidentStatusSchema,
  incidentQuerySchema
} = require("../validators/incidentPanic.validator");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

// Report incident (Teachers, School Admin, Transport Coordinator, Parents)
// Parents are scoped to their own child's class/bus context in the service layer.
router.post(
  "/",
  requireActiveStatus,
  authorizeRoles(
    ROLES.CLASS_TEACHER,
    ROLES.SUBJECT_TEACHER,
    ROLES.SCHOOL_ADMIN,
    ROLES.TRANSPORT_COORDINATOR,
    ROLES.PARENT
  ),
  validate(createIncidentSchema),
  IncidentPanicController.reportIncident
);

// List incidents with pagination and filters (School Admin, Transport Coordinator, Class Teacher)
router.get(
  "/",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR, ROLES.CLASS_TEACHER),
  validate(incidentQuerySchema, "query"),
  IncidentPanicController.listIncidents
);

// Update incident status with enforced transition flow (School Admin, Transport Coordinator, Class Teacher)
router.put(
  "/:incidentCode/status",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR, ROLES.CLASS_TEACHER),
  validate(updateIncidentStatusSchema),
  IncidentPanicController.updateStatus
);

module.exports = router;
