/**
 * Transport Routes
 */

const express = require("express");
const TransportController = require("../controllers/transport.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles, requireActiveStatus } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");
const {
  validate,
  createBusSchema,
  updateBusSchema,
  createRouteSchema,
  updateRouteSchema,
  createStopSchema,
  updateStopSchema,
  stopQuerySchema,
  tripStartSchema,
  tripStatusSchema,
  telemetrySchema,
  transportAccessRequestApplySchema,
  transportAccessRequestReviewSchema,
  accessRequestQuerySchema
} = require("../validators/transport.validator");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);
router.use(requireActiveStatus);

// Bus & Route Management (School Admin & Transport Coordinator)
router.post(
  "/buses",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(createBusSchema),
  TransportController.createBus
);
router.get(
  "/buses",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  TransportController.listBuses
);
router.get(
  "/buses/:busCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  TransportController.getBusDetail
);
router.put(
  "/buses/:busCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(updateBusSchema),
  TransportController.updateBus
);
router.post(
  "/routes",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(createRouteSchema),
  TransportController.createRoute
);
router.get(
  "/routes",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR, ROLES.DRIVER, ROLES.PARENT),
  TransportController.listRoutes
);
router.put(
  "/routes/:routeCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(updateRouteSchema),
  TransportController.updateRoute
);
router.delete(
  "/routes/:routeCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  TransportController.deleteRoute
);
router.get(
  "/fleet",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  TransportController.getFleetStatus
);

// Bus stops (School Admin & Transport Coordinator)
router.post(
  "/stops",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(createStopSchema),
  TransportController.createStop
);
router.get(
  "/stops",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR, ROLES.DRIVER, ROLES.PARENT),
  validate(stopQuerySchema, "query"),
  TransportController.listStops
);
router.put(
  "/stops/:stopCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(updateStopSchema),
  TransportController.updateStop
);
router.delete(
  "/stops/:stopCode",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  TransportController.deleteStop
);

// Driver mobile endpoints
router.get(
  "/driver/assignment",
  authorizeRoles(ROLES.DRIVER),
  TransportController.getDriverAssignment
);
router.post(
  "/trips/start",
  authorizeRoles(ROLES.DRIVER),
  validate(tripStartSchema),
  TransportController.startTrip
);
router.put(
  "/trips/:tripId/status",
  authorizeRoles(ROLES.DRIVER),
  validate(tripStatusSchema),
  TransportController.updateTripStatus
);
router.post(
  "/telemetry/location",
  authorizeRoles(ROLES.DRIVER),
  validate(telemetrySchema),
  TransportController.ingestLocation
);

// Parent delayed location endpoint
router.get(
  "/parent/student/:studentCode/location",
  authorizeRoles(ROLES.PARENT),
  TransportController.getParentBusLocation
);

// Transport access requests
router.post(
  "/access-requests",
  authorizeRoles(ROLES.PARENT),
  validate(transportAccessRequestApplySchema),
  TransportController.applyTransportAccess
);
router.get(
  "/access-requests",
  authorizeRoles(ROLES.PARENT, ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(accessRequestQuerySchema, "query"),
  TransportController.listAccessRequests
);
router.put(
  "/access-requests/:requestCode/review",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  validate(transportAccessRequestReviewSchema),
  TransportController.reviewAccessRequest
);
router.put(
  "/access-requests/:requestCode/revoke",
  authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.TRANSPORT_COORDINATOR),
  TransportController.revokeAccessRequest
);

module.exports = router;
