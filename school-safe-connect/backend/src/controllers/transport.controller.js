/**
 * Transport Controller
 */

const TransportService = require("../services/transport.service");
const { Bus, Route } = require("../models");
const { sendSuccess, sendCreated } = require("../utils/response");

class TransportController {
  static async createBus(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const bus = await TransportService.createBus({
        schoolCode: req.tenantSchoolCode,
        busNumber: req.validatedBody.busNumber,
        registrationNumber: req.validatedBody.registrationNumber,
        capacity: req.validatedBody.capacity,
        driverCode: req.validatedBody.driverCode,
        routeCode: req.validatedBody.routeCode,
        makeModel: req.validatedBody.makeModel,
        gpsDeviceId: req.validatedBody.gpsDeviceId,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Bus created successfully.", bus);
    } catch (err) {
      next(err);
    }
  }

  static async listBuses(req, res, next) {
    try {
      const buses = await Bus.find({ schoolCode: req.tenantSchoolCode });
      return sendSuccess(res, "Buses retrieved.", { buses, count: buses.length });
    } catch (err) {
      next(err);
    }
  }

  static async createRoute(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const route = await TransportService.createRoute({
        schoolCode: req.tenantSchoolCode,
        routeName: req.validatedBody.routeName,
        startLocation: req.validatedBody.startLocation,
        endLocation: req.validatedBody.endLocation,
        stops: req.validatedBody.stops,
        busCode: req.validatedBody.busCode,
        driverCode: req.validatedBody.driverCode,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Route created successfully.", route);
    } catch (err) {
      next(err);
    }
  }

  static async listRoutes(req, res, next) {
    try {
      const result = await TransportService.listRoutes({ schoolCode: req.tenantSchoolCode });
      return sendSuccess(res, "Routes retrieved.", { routes: result.routes, count: result.total });
    } catch (err) {
      next(err);
    }
  }

  static async updateRoute(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const route = await TransportService.updateRoute({
        schoolCode: req.tenantSchoolCode,
        routeCode: req.params.routeCode,
        updates: req.validatedBody,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Route updated successfully.", route);
    } catch (err) {
      next(err);
    }
  }

  static async deleteRoute(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await TransportService.deleteRoute({
        schoolCode: req.tenantSchoolCode,
        routeCode: req.params.routeCode,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Route deleted successfully.", result);
    } catch (err) {
      next(err);
    }
  }

  // Driver assignment lookup
  static async getDriverAssignment(req, res, next) {
    try {
      const assignment = await TransportService.getDriverAssignment({
        schoolCode: req.tenantSchoolCode,
        driverUser: req.user
      });
      return sendSuccess(res, "Driver assignment retrieved.", assignment);
    } catch (err) {
      next(err);
    }
  }

  // Driver start trip
  static async startTrip(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const trip = await TransportService.startTrip({
        schoolCode: req.tenantSchoolCode,
        driverUser: req.user,
        busCode: req.validatedBody.busCode,
        routeCode: req.validatedBody.routeCode,
        tripType: req.validatedBody.tripType,
        initialLocation: req.validatedBody.initialLocation,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Trip started successfully.", trip);
    } catch (err) {
      next(err);
    }
  }

  // Driver update trip status
  static async updateTripStatus(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const trip = await TransportService.updateTripStatus({
        schoolCode: req.tenantSchoolCode,
        tripId: req.params.tripId,
        status: req.validatedBody.status,
        currentStopId: req.validatedBody.currentStopId,
        delayedByMinutes: req.validatedBody.delayedByMinutes,
        delayReason: req.validatedBody.delayReason,
        driverUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Trip status updated.", trip);
    } catch (err) {
      next(err);
    }
  }

  // Driver location stream ingestion
  static async ingestLocation(req, res, next) {
    try {
      const record = await TransportService.ingestLocation({
        schoolCode: req.tenantSchoolCode,
        tripId: req.validatedBody.tripId,
        busCode: req.validatedBody.busCode,
        routeCode: req.validatedBody.routeCode,
        driverUser: req.user,
        latitude: req.validatedBody.latitude,
        longitude: req.validatedBody.longitude,
        speedKmph: req.validatedBody.speedKmph,
        accuracyMeters: req.validatedBody.accuracyMeters,
        deviceTimestamp: req.validatedBody.deviceTimestamp,
        resetTrail: req.validatedBody.resetTrail,
        visibleNow: req.validatedBody.visibleNow
      });

      return sendCreated(res, "Telemetry location ingested.", { visibleAfter: record.visibleAfter });
    } catch (err) {
      next(err);
    }
  }

  // Parent delayed bus location view
  static async getParentBusLocation(req, res, next) {
    try {
      const result = await TransportService.getDelayedBusLocationForParent({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        studentCode: req.params.studentCode
      });

      return sendSuccess(res, "Delayed bus location retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  // Fleet status for Transport Coordinator / School Admin
  static async getFleetStatus(req, res, next) {
    try {
      const result = await TransportService.getLiveFleetStatus({ schoolCode: req.tenantSchoolCode });
      return sendSuccess(res, "Live fleet telemetry retrieved.", {
        fleet: result.fleet,
        routes: result.routes,
        count: result.fleet.length
      });
    } catch (err) {
      next(err);
    }
  }

  static async getBusDetail(req, res, next) {
    try {
      const bus = await TransportService.getBusDetail({
        schoolCode: req.tenantSchoolCode,
        busCode: req.params.busCode
      });

      return sendSuccess(res, "Bus details retrieved.", bus);
    } catch (err) {
      next(err);
    }
  }

  static async updateBus(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const bus = await TransportService.updateBus({
        schoolCode: req.tenantSchoolCode,
        busCode: req.params.busCode,
        updates: req.validatedBody,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Bus updated.", bus);
    } catch (err) {
      next(err);
    }
  }

  static async createStop(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const stop = await TransportService.createStop({
        schoolCode: req.tenantSchoolCode,
        ...req.validatedBody,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Stop created successfully.", stop);
    } catch (err) {
      next(err);
    }
  }

  static async listStops(req, res, next) {
    try {
      const { page, limit } = req.validatedBody || {};

      const result = await TransportService.listStops({
        schoolCode: req.tenantSchoolCode,
        routeCode: req.validatedBody.routeCode,
        page,
        limit
      });

      return sendSuccess(res, "Stops retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async updateStop(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const stop = await TransportService.updateStop({
        schoolCode: req.tenantSchoolCode,
        stopCode: req.params.stopCode,
        updates: req.validatedBody,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Stop updated.", stop);
    } catch (err) {
      next(err);
    }
  }

  static async deleteStop(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await TransportService.deleteStop({
        schoolCode: req.tenantSchoolCode,
        stopCode: req.params.stopCode,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Stop deleted.", result);
    } catch (err) {
      next(err);
    }
  }

  static async applyTransportAccess(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const { studentCode, routeCode, busCode } = req.validatedBody || {};

      const request = await TransportService.applyTransportAccess({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        studentCode,
        routeCode,
        busCode,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Transport access request submitted.", request);
    } catch (err) {
      next(err);
    }
  }

  static async listAccessRequests(req, res, next) {
    try {
      const { page, limit, ...filters } = req.validatedBody || {};

      const result = await TransportService.listAccessRequests({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        userRole: req.user.role,
        filters,
        page,
        limit
      });

      return sendSuccess(res, "Transport access requests retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async reviewAccessRequest(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";
      const { status, remarks } = req.validatedBody || {};

      const request = await TransportService.reviewAccessRequest({
        schoolCode: req.tenantSchoolCode,
        requestCode: req.params.requestCode,
        status,
        remarks,
        reviewerUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Access request reviewed.", request);
    } catch (err) {
      next(err);
    }
  }

  static async revokeAccessRequest(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const request = await TransportService.revokeAccessRequest({
        schoolCode: req.tenantSchoolCode,
        requestCode: req.params.requestCode,
        revokerUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Access request revoked.", request);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TransportController;
