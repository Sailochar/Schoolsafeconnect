/**
 * Event Gallery Routes
 */

const express = require("express");
const EventController = require("../controllers/event.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

const schoolAdminOnly = authorizeRoles(ROLES.SCHOOL_ADMIN);
const galleryViewers = authorizeRoles(
  ROLES.SCHOOL_ADMIN,
  ROLES.CLASS_TEACHER,
  ROLES.SUBJECT_TEACHER,
  ROLES.PARENT,
  ROLES.DRIVER,
  ROLES.TRANSPORT_COORDINATOR
);

router.get("/", galleryViewers, EventController.listEvents);
router.post("/", schoolAdminOnly, EventController.createEvent);
router.delete("/:id", schoolAdminOnly, EventController.deleteEvent);

module.exports = router;
