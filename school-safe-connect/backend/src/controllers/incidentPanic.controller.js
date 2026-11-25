/**
 * Incident and Panic Alert Controller
 * All tenant context is bound by tenantGuard (req.tenantSchoolCode); client-supplied schoolCode is never trusted.
 */

const IncidentPanicService = require("../services/incidentPanic.service");
const { sendSuccess, sendCreated } = require("../utils/response");

class IncidentPanicController {
  static async reportIncident(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const { type, severity, classCode, busId, description, attachments } = req.validatedBody || {};

      const incident = await IncidentPanicService.reportIncident({
        schoolCode: req.tenantSchoolCode,
        reporterUser: req.user,
        type,
        severity,
        classCode,
        busId,
        description,
        attachments,
        ipAddress,
        userAgent
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`tenant_${req.tenantSchoolCode}`).emit("INCIDENT_REPORTED", {
          incidentCode: incident.incidentCode,
          schoolCode: req.tenantSchoolCode,
          type,
          severity,
          reportedBy: req.user.userCode,
          createdAt: incident.createdAt
        });
      }

      return sendCreated(res, "Incident reported successfully.", incident);
    } catch (err) {
      next(err);
    }
  }

  static async listIncidents(req, res, next) {
    try {
      const { page, limit, ...filters } = req.validatedBody || {};
      const result = await IncidentPanicService.listIncidents({
        schoolCode: req.tenantSchoolCode,
        filters,
        page,
        limit
      });
      return sendSuccess(res, "Incidents retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async updateStatus(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const { status, remarks } = req.validatedBody || {};

      const incident = await IncidentPanicService.updateIncidentStatus({
        schoolCode: req.tenantSchoolCode,
        incidentCode: req.params.incidentCode,
        status,
        remarks,
        updaterUser: req.user,
        ipAddress,
        userAgent
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`tenant_${req.tenantSchoolCode}`).emit("INCIDENT_STATUS_CHANGED", {
          incidentCode: incident.incidentCode,
          schoolCode: req.tenantSchoolCode,
          status,
          changedBy: req.user.userCode,
          changedAt: new Date().toISOString()
        });
      }

      return sendSuccess(res, "Incident status updated.", incident);
    } catch (err) {
      next(err);
    }
  }

  static async triggerSOS(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const { confirmed, location, remarks, classCode, busId } = req.validatedBody || {};

      const result = await IncidentPanicService.triggerPanicAlert({
        schoolCode: req.tenantSchoolCode,
        triggerUser: req.user,
        confirmed,
        location,
        remarks,
        classCode,
        busId,
        ipAddress,
        userAgent
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`tenant_${req.tenantSchoolCode}`).emit("PANIC_ALERT_TRIGGERED", {
          alertCode: result.panicAlert.alertCode,
          incidentCode: result.linkedIncident.incidentCode,
          schoolCode: req.tenantSchoolCode,
          triggeredBy: req.user.userCode,
          userRole: req.user.role,
          priority: "CRITICAL",
          status: "TRIGGERED",
          createdAt: result.panicAlert.createdAt
        });
      }

      return sendCreated(res, "CRITICAL SOS ALERT TRIGGERED. Emergency response notified.", result);
    } catch (err) {
      next(err);
    }
  }

  static async listPanicAlerts(req, res, next) {
    try {
      const { page, limit, ...filters } = req.validatedBody || {};
      const result = await IncidentPanicService.listPanicAlerts({
        schoolCode: req.tenantSchoolCode,
        filters,
        page,
        limit
      });
      return sendSuccess(res, "Panic alerts retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async listMyPanicAlerts(req, res, next) {
    try {
      const { page, limit, ...filters } = req.validatedBody || {};
      const result = await IncidentPanicService.listPanicAlerts({
        schoolCode: req.tenantSchoolCode,
        filters,
        page,
        limit,
        triggeredBy: req.user.userCode
      });
      return sendSuccess(res, "Your panic alerts retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async updatePanicStatus(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const { status, remarks } = req.validatedBody || {};

      const alert = await IncidentPanicService.updatePanicStatus({
        schoolCode: req.tenantSchoolCode,
        alertCode: req.params.alertCode,
        status,
        remarks,
        updaterUser: req.user,
        ipAddress,
        userAgent
      });

      const io = req.app.get("io");
      if (io) {
        io.to(`tenant_${req.tenantSchoolCode}`).emit("PANIC_ALERT_STATUS_CHANGED", {
          alertCode: alert.alertCode,
          schoolCode: req.tenantSchoolCode,
          status,
          changedBy: req.user.userCode,
          changedAt: new Date().toISOString()
        });
      }

      return sendSuccess(res, "Panic alert status updated.", alert);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = IncidentPanicController;
