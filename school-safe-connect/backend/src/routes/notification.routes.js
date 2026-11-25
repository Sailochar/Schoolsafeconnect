/**
 * Notification Routes
 * User-scoped, tenant-isolated notification endpoints.
 */

const express = require("express");
const NotificationController = require("../controllers/notification.controller");
const { authenticate } = require("../middlewares/authMiddleware");
const tenantGuard = require("../middlewares/tenantGuard");
const { requireActiveStatus } = require("../middlewares/rbacGuard");

const router = express.Router();

// All notification endpoints require authentication + tenant isolation + active account
router.use(authenticate);
router.use(tenantGuard);
router.use(requireActiveStatus);

// My notifications
router.get("/", NotificationController.listMyNotifications);
router.get("/unread-count", NotificationController.unreadCount);
router.patch("/:notificationId/read", NotificationController.markRead);
router.patch("/read-all", NotificationController.markReadAll);

// Preferences
router.get("/preferences", NotificationController.getPreferences);
router.put("/preferences", NotificationController.updatePreferences);

// Devices (FCM tokens)
router.post("/devices/register", NotificationController.registerDevice);
router.delete("/devices/unregister", NotificationController.unregisterDevice);

module.exports = router;
