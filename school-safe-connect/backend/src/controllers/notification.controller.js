/**
 * Notification Controller
 * User-scoped, tenant-isolated notification endpoints.
 */

const NotificationService = require("../services/notification.service");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class NotificationController {
  /**
   * GET /api/v1/notifications
   * List my notifications (paginated, tenant-scoped).
   */
  static async listMyNotifications(req, res, next) {
    try {
      const { error, value } = require("../validators/notification.validator")
        .notificationQuerySchema.validate(req.query, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const { notifications, total, page, limit } = await NotificationService.getUserNotifications({
        schoolCode,
        userCode,
        page: value.page,
        limit: value.limit,
        status: value.status,
        eventType: value.eventType,
        unread: value.unread === "true" ? true : value.unread === "false" ? false : undefined
      });

      return sendSuccess(
        res,
        "Notifications retrieved.",
        { notifications },
        { total, page, limit },
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/unread-count
   * My unread notification count.
   */
  static async unreadCount(req, res, next) {
    try {
      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const count = await NotificationService.getUnreadCount({ schoolCode, userCode });
      return sendSuccess(res, "Unread count retrieved.", { unreadCount: count }, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/:notificationId/read
   * Mark a single notification read (tenant + recipient scoped).
   */
  static async markRead(req, res, next) {
    try {
      const { error, value } = require("../validators/notification.validator")
        .markReadSchema.validate({ notificationId: req.params.notificationId }, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const notification = await NotificationService.markRead({
        schoolCode,
        notificationId: value.notificationId,
        userCode
      });

      return sendSuccess(res, "Notification marked as read.", { notification }, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PATCH /api/v1/notifications/read-all
   * Mark all my notifications read.
   */
  static async markReadAll(req, res, next) {
    try {
      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const result = await NotificationService.markReadAll({ schoolCode, userCode });
      return sendSuccess(
        res,
        "All notifications marked as read.",
        { modifiedCount: result.modifiedCount },
        null,
        200
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/notifications/preferences
   * Get my notification preferences.
   */
  static async getPreferences(req, res, next) {
    try {
      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const preferences = await NotificationService.getPreferences(schoolCode, userCode);
      return sendSuccess(res, "Preferences retrieved.", { preferences }, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * PUT /api/v1/notifications/preferences
   * Update my notification preferences.
   */
  static async updatePreferences(req, res, next) {
    try {
      const { error, value } = require("../validators/notification.validator")
        .preferenceUpdateSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const preferences = await NotificationService.updatePreferences(schoolCode, userCode, value);
      return sendSuccess(res, "Preferences updated.", { preferences }, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/notifications/devices/register
   * Register/update FCM token and device info for my user in my tenant.
   */
  static async registerDevice(req, res, next) {
    try {
      const { error, value } = require("../validators/notification.validator")
        .deviceRegisterSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      const device = await NotificationService.registerDevice({
        schoolCode,
        userCode,
        deviceId: value.deviceId,
        fcmToken: value.fcmToken || undefined,
        deviceModel: value.deviceModel,
        osVersion: value.osVersion,
        appVersion: value.appVersion,
        platform: value.platform
      });

      return sendCreated(res, "Device registered.", { device });
    } catch (err) {
      next(err);
    }
  }

  /**
   * DELETE /api/v1/notifications/devices/unregister
   * Deactivate/disassociate a device for my user in my tenant.
   */
  static async unregisterDevice(req, res, next) {
    try {
      const { error, value } = require("../validators/notification.validator")
        .deviceUnregisterSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const schoolCode = req.tenantSchoolCode;
      const userCode = req.user.userCode;

      await NotificationService.unregisterDevice({
        schoolCode,
        userCode,
        deviceId: value.deviceId
      });

      return sendSuccess(res, "Device unregistered.", null, null, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = NotificationController;

