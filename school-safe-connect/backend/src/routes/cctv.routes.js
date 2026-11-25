/**
 * CCTV Routes
 */

const express = require("express");
const CctvController = require("../controllers/cctv.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { authorizeRoles } = require("../middlewares/rbacGuard");
const { ROLES } = require("../config/constants");

const router = express.Router();

router.use(authenticate);
router.use(tenantGuard);

// Camera management and retrieval
router.post("/cameras", authorizeRoles(ROLES.SCHOOL_ADMIN), CctvController.registerCamera);
router.get("/cameras", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER, ROLES.PARENT), CctvController.listCameras);

// Parent requests & streaming
router.post("/requests", authorizeRoles(ROLES.PARENT), CctvController.requestAccess);
router.get("/requests/pending", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER), CctvController.listPendingRequests);
router.put("/requests/:requestCode/review", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.CLASS_TEACHER), CctvController.reviewRequest);

// Live Streaming Session Controls
router.post("/sessions/start", authorizeRoles(ROLES.SCHOOL_ADMIN, ROLES.PARENT, ROLES.CLASS_TEACHER), CctvController.startSession);
router.post("/sessions/:sessionId/end", CctvController.endSession);

module.exports = router;
