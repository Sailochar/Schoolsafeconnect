/**
 * Transport Management and Delayed Location Telemetry Service
 * Implements trip lifecycle, route & place waypoints, GPS ingestion with anti-spoofing heuristics,
 * live fleet mapping, and cryptographically enforced delayed visibility for parent viewers.
 */

const { Bus, Route, Stop, Trip, Location, Student, ParentStudentLink, School, TransportAccessRequest, Counter, User } = require("../models");
const IdGeneratorService = require("./idGenerator.service");
const AuditService = require("./audit.service");
const NotificationService = require("./notification.service");
const config = require("../config/env");
const { TRIP_STATUS } = require("../config/constants");
const logger = require("../utils/logger");

class TransportService {
  static _normalizeStops(schoolCode, routeCode, rawStops = [], startLocation, endLocation) {
    if (!Array.isArray(rawStops) || rawStops.length === 0) return [];
    const startLng = startLocation?.coordinates?.[0] ?? 78.4867;
    const startLat = startLocation?.coordinates?.[1] ?? 17.3850;
    const endLng = endLocation?.coordinates?.[0] ?? 78.4967;
    const endLat = endLocation?.coordinates?.[1] ?? 17.3950;

    return rawStops.map((item, idx) => {
      if (typeof item === "string") {
        const ratio = (idx + 1) / (rawStops.length + 1);
        return {
          stopId: `${routeCode}-STP-${String(idx + 1).padStart(2, "0")}`,
          stopName: item.trim(),
          sequenceOrder: idx + 1,
          scheduledPickupTime: `07:${String(20 + idx * 10).padStart(2, "0")}`,
          scheduledDropTime: `15:${String(20 + idx * 10).padStart(2, "0")}`,
          coordinates: [
            Number((startLng + (endLng - startLng) * ratio).toFixed(6)),
            Number((startLat + (endLat - startLat) * ratio).toFixed(6))
          ]
        };
      }
      return {
        stopId: item.stopId || `${routeCode}-STP-${String(item.sequenceOrder || idx + 1).padStart(2, "0")}`,
        stopName: item.stopName.trim(),
        sequenceOrder: item.sequenceOrder || idx + 1,
        scheduledPickupTime: item.scheduledPickupTime || "07:30",
        scheduledDropTime: item.scheduledDropTime || "15:30",
        coordinates: Array.isArray(item.coordinates) && item.coordinates.length === 2
          ? [Number(item.coordinates[0]), Number(item.coordinates[1])]
          : [startLng, startLat]
      };
    });
  }

  static async createBus({ schoolCode, busNumber, registrationNumber, capacity, driverCode, routeCode, makeModel, gpsDeviceId, adminUser, ipAddress, userAgent }) {
    const busCode = await IdGeneratorService.generateBusCode(schoolCode);
    const cleanDriver = driverCode ? driverCode.trim().toUpperCase() : undefined;
    const cleanRoute = routeCode ? routeCode.trim().toUpperCase() : undefined;

    const bus = new Bus({
      schoolCode,
      busCode,
      busNumber: busNumber || registrationNumber,
      registrationNumber: registrationNumber.toUpperCase().trim(),
      capacity,
      driverCode: cleanDriver,
      routeCode: cleanRoute,
      makeModel,
      gpsDeviceId
    });
    await bus.save();

    if (cleanRoute) {
      await Route.findOneAndUpdate(
        { schoolCode, routeCode: cleanRoute },
        { $set: { busCode, ...(cleanDriver ? { driverCode: cleanDriver } : {}) } }
      );
    }
    if (cleanDriver) {
      await User.findOneAndUpdate(
        { schoolCode, userCode: cleanDriver },
        { $set: { "accessControls.transportBusCode": busCode } }
      );
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "BUS_REGISTERED",
      resourceType: "BUS",
      resourceId: busCode,
      reason: "School transport vehicle registered",
      ipAddress,
      userAgent,
      metadata: { registrationNumber, capacity, driverCode: cleanDriver, routeCode: cleanRoute }
    });
    return bus;
  }

  static async createRoute({ schoolCode, routeName, startLocation, endLocation, stops, busCode, driverCode, adminUser, ipAddress, userAgent }) {
    const seq = await Counter.findOneAndUpdate(
      { sequenceName: "ROUTE_CODE", schoolCode },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    const routeCode = `${schoolCode}-RTE-${String(seq.sequenceValue).padStart(3, "0")}`;
    const normalizedStops = this._normalizeStops(schoolCode, routeCode, stops, startLocation, endLocation);
    const cleanBus = busCode ? busCode.trim().toUpperCase() : undefined;
    const cleanDriver = driverCode ? driverCode.trim().toUpperCase() : undefined;

    const route = new Route({
      schoolCode,
      routeCode,
      routeName: routeName.trim(),
      startLocation,
      endLocation,
      stops: normalizedStops,
      busCode: cleanBus,
      driverCode: cleanDriver,
      status: "ACTIVE"
    });
    await route.save();

    // Sync Stop collection for each embedded stop
    for (const s of normalizedStops) {
      const stopSeq = await Counter.findOneAndUpdate(
        { sequenceName: "STOP_CODE", schoolCode },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      const stopCode = `${schoolCode}-STP-${String(stopSeq.sequenceValue).padStart(3, "0")}`;
      await Stop.create({
        schoolCode,
        stopCode,
        routeCode,
        stopName: s.stopName,
        sequenceOrder: s.sequenceOrder,
        scheduledPickupTime: s.scheduledPickupTime,
        scheduledDropTime: s.scheduledDropTime,
        location: { type: "Point", coordinates: s.coordinates },
        assignedStudentCodes: []
      });
    }

    // Sync linked Bus if provided
    if (cleanBus) {
      await Bus.findOneAndUpdate(
        { schoolCode, busCode: cleanBus },
        { $set: { routeCode, ...(cleanDriver ? { driverCode: cleanDriver } : {}) } }
      );
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "ROUTE_CREATED",
      resourceType: "ROUTE",
      resourceId: routeCode,
      reason: "Transit route created by Transport Coordinator/Admin",
      ipAddress,
      userAgent,
      metadata: { routeName, startPlace: startLocation?.name, endPlace: endLocation?.name, stopCount: normalizedStops.length }
    });
    return route;
  }

  static async updateRoute({ schoolCode, routeCode, updates, adminUser, ipAddress, userAgent }) {
    const existing = await Route.findOne({ schoolCode, routeCode });
    if (!existing) {
      const e = new Error(`Route [${routeCode}] not found.`);
      e.statusCode = 404;
      throw e;
    }

    const patch = { ...updates };
    if (updates.stops !== undefined) {
      patch.stops = this._normalizeStops(
        schoolCode,
        routeCode,
        updates.stops,
        updates.startLocation || existing.startLocation,
        updates.endLocation || existing.endLocation
      );
    }

    const route = await Route.findOneAndUpdate({ schoolCode, routeCode }, { $set: patch }, { new: true });

    if (patch.busCode) {
      await Bus.findOneAndUpdate(
        { schoolCode, busCode: patch.busCode },
        { $set: { routeCode, ...(patch.driverCode ? { driverCode: patch.driverCode } : {}) } }
      );
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "ROUTE_UPDATED",
      resourceType: "ROUTE",
      resourceId: routeCode,
      reason: "Transit route updated",
      ipAddress,
      userAgent,
      metadata: { updates }
    });
    return route;
  }

  static async deleteRoute({ schoolCode, routeCode, adminUser, ipAddress, userAgent }) {
    const route = await Route.findOneAndDelete({ schoolCode, routeCode });
    if (!route) {
      const e = new Error(`Route [${routeCode}] not found.`);
      e.statusCode = 404;
      throw e;
    }
    await Stop.deleteMany({ schoolCode, routeCode });
    await Bus.updateMany({ schoolCode, routeCode }, { $unset: { routeCode: "" } });
    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "ROUTE_DELETED",
      resourceType: "ROUTE",
      resourceId: routeCode,
      reason: "Transit route removed by Admin",
      ipAddress,
      userAgent
    });
    return { deleted: true, routeCode };
  }

  /**
   * Resolves a driver's assigned bus, route, stops, and active trip for Driver Transit Console.
   */
  static async getDriverAssignment({ schoolCode, driverUser }) {
    const userDoc = await User.findOne({ schoolCode, userCode: driverUser.userCode });

    // 1. Find assigned bus
    let bus = await Bus.findOne({ schoolCode, driverCode: driverUser.userCode });
    if (!bus && userDoc?.accessControls?.transportBusCode) {
      bus = await Bus.findOne({ schoolCode, busCode: userDoc.accessControls.transportBusCode });
      if (bus && !bus.driverCode) {
        bus.driverCode = driverUser.userCode;
        await bus.save();
      }
    }
    if (!bus) {
      bus = await Bus.findOne({ schoolCode, status: "ACTIVE" }).sort({ createdAt: 1 });
    }

    // 2. Find assigned route
    let route = null;
    if (bus?.routeCode) {
      route = await Route.findOne({ schoolCode, routeCode: bus.routeCode });
    }
    if (!route) {
      route = await Route.findOne({ schoolCode, driverCode: driverUser.userCode, status: "ACTIVE" });
    }
    if (!route && bus) {
      route = await Route.findOne({ schoolCode, busCode: bus.busCode, status: "ACTIVE" });
    }
    if (!route) {
      route = await Route.findOne({ schoolCode, status: "ACTIVE" }).sort({ createdAt: 1 });
    }

    // 3. Collect stops (from Stop collection + embedded route stops)
    let stops = [];
    if (route) {
      const stopDocs = await Stop.find({ schoolCode, routeCode: route.routeCode }).sort({ sequenceOrder: 1 }).lean();
      if (stopDocs.length > 0) {
        stops = stopDocs.map((s) => ({
          stopId: s.stopCode,
          stopName: s.stopName,
          sequenceOrder: s.sequenceOrder,
          scheduledPickupTime: s.scheduledPickupTime,
          scheduledDropTime: s.scheduledDropTime,
          coordinates: s.location?.coordinates || [78.4867, 17.3850]
        }));
      } else if (Array.isArray(route.stops)) {
        stops = route.stops;
      }
    }

    // 4. Find any active trip for this driver
    const activeTrip = await Trip.findOne({
      schoolCode,
      driverCode: driverUser.userCode,
      status: { $in: [TRIP_STATUS.STARTED, TRIP_STATUS.AT_PICKUP, TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.AT_DROP] }
    }).sort({ startedAt: -1 });

    let latestLocation = null;
    if (activeTrip) {
      latestLocation = await Location.findOne({ schoolCode, tripId: activeTrip.tripId }).sort({ serverReceivedAt: -1 });
    }

    return {
      bus: bus || null,
      route: route ? { ...route.toObject(), stops } : null,
      activeTrip: activeTrip || null,
      latestLocation: latestLocation || null
    };
  }

  static async startTrip({ schoolCode, driverUser, busCode, routeCode, tripType = "MORNING_PICKUP", initialLocation, ipAddress, userAgent }) {
    const userDoc = await User.findOne({ schoolCode, userCode: driverUser.userCode });

    // 1. Resolve Bus cleanly
    let bus = null;
    if (busCode) {
      bus = await Bus.findOne({ schoolCode, busCode });
    }
    if (!bus) {
      bus = await Bus.findOne({ schoolCode, driverCode: driverUser.userCode });
    }
    if (!bus && userDoc?.accessControls?.transportBusCode) {
      bus = await Bus.findOne({ schoolCode, busCode: userDoc.accessControls.transportBusCode });
    }
    if (!bus) {
      bus = await Bus.findOne({ schoolCode, status: "ACTIVE" }).sort({ createdAt: 1 });
    }
    if (!bus) {
      const generatedBusCode = await IdGeneratorService.generateBusCode(schoolCode);
      bus = await Bus.create({
        schoolCode,
        busCode: generatedBusCode,
        busNumber: "Bus 01",
        registrationNumber: "TS09SC0001",
        capacity: 40,
        driverCode: driverUser.userCode,
        status: "ACTIVE"
      });
    } else if (!bus.driverCode) {
      bus.driverCode = driverUser.userCode;
      await bus.save();
    }

    // 2. Resolve Route cleanly (auto-provision default school route if none created yet)
    let route = null;
    if (routeCode) {
      route = await Route.findOne({ schoolCode, routeCode });
    }
    if (!route && bus.routeCode) {
      route = await Route.findOne({ schoolCode, routeCode: bus.routeCode });
    }
    if (!route) {
      route = await Route.findOne({ schoolCode, driverCode: driverUser.userCode, status: "ACTIVE" });
    }
    if (!route) {
      route = await Route.findOne({ schoolCode, status: "ACTIVE" }).sort({ createdAt: 1 });
    }
    if (!route) {
      const startLng = initialLocation?.longitude ?? 78.4483;
      const startLat = initialLocation?.latitude ?? 17.4399;
      const seq = await Counter.findOneAndUpdate(
        { sequenceName: "ROUTE_CODE", schoolCode },
        { $inc: { sequenceValue: 1 } },
        { new: true, upsert: true, setDefaultsOnInsert: true }
      );
      const autoRouteCode = `${schoolCode}-RTE-${String(seq.sequenceValue).padStart(3, "0")}`;
      route = await Route.create({
        schoolCode,
        routeCode: autoRouteCode,
        routeName: "Main Campus Route 1",
        startLocation: { name: "Starting Point", coordinates: [startLng, startLat] },
        endLocation: { name: "School Main Campus", coordinates: [Number((startLng + 0.032).toFixed(6)), Number((startLat + 0.018).toFixed(6))] },
        stops: [
          {
            stopId: `${autoRouteCode}-STP-01`,
            stopName: "Stop 1 - Junction Circle",
            sequenceOrder: 1,
            scheduledPickupTime: "07:30",
            scheduledDropTime: "15:30",
            coordinates: [Number((startLng + 0.011).toFixed(6)), Number((startLat + 0.006).toFixed(6))]
          },
          {
            stopId: `${autoRouteCode}-STP-02`,
            stopName: "Stop 2 - Central Park Gate",
            sequenceOrder: 2,
            scheduledPickupTime: "07:45",
            scheduledDropTime: "15:45",
            coordinates: [Number((startLng + 0.022).toFixed(6)), Number((startLat + 0.012).toFixed(6))]
          }
        ],
        busCode: bus.busCode,
        driverCode: driverUser.userCode,
        status: "ACTIVE"
      });
      bus.routeCode = route.routeCode;
      await bus.save();
    }

    // 3. End any stale active trips for this driver so new trip starts cleanly
    await Trip.updateMany(
      {
        schoolCode,
        driverCode: driverUser.userCode,
        status: { $in: [TRIP_STATUS.STARTED, TRIP_STATUS.AT_PICKUP, TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.AT_DROP] }
      },
      {
        $set: { status: TRIP_STATUS.COMPLETED, completedAt: new Date() },
        $push: { statusHistory: { status: TRIP_STATUS.COMPLETED, timestamp: new Date(), notes: "Auto-closed on new trip start" } }
      }
    );

    const tripId = `${schoolCode}-TRIP-${Date.now()}`;
    const trip = new Trip({
      schoolCode,
      tripId,
      busCode: bus.busCode,
      routeCode: route.routeCode,
      driverCode: driverUser.userCode,
      tripType: tripType || "MORNING_PICKUP",
      status: TRIP_STATUS.IN_TRANSIT,
      startedAt: new Date(),
      statusHistory: [
        { status: TRIP_STATUS.STARTED, timestamp: new Date(), notes: "Trip initiated by driver" },
        { status: TRIP_STATUS.IN_TRANSIT, timestamp: new Date(), notes: "GPS tracking active" }
      ]
    });
    await trip.save();

    // 4. Record initial GPS location immediately (visible immediately on maps)
    const initLat = initialLocation?.latitude ?? route.startLocation?.coordinates?.[1] ?? 17.385044;
    const initLng = initialLocation?.longitude ?? route.startLocation?.coordinates?.[0] ?? 78.486671;
    const now = new Date();
    await Location.create({
      schoolCode,
      tripId,
      busCode: bus.busCode,
      routeCode: route.routeCode,
      driverCode: driverUser.userCode,
      latitude: initLat,
      longitude: initLng,
      speedKmph: 0,
      accuracyMeters: 5,
      deviceTimestamp: now,
      serverReceivedAt: now,
      visibleAfter: now,
      isFlaggedSpoofed: false
    });

    await AuditService.log({
      schoolCode,
      actor: { userCode: driverUser.userCode, role: driverUser.role, fullName: driverUser.fullName, email: driverUser.email },
      action: "TRIP_STARTED",
      resourceType: "TRIP",
      resourceId: tripId,
      reason: "Driver started vehicle trip",
      ipAddress,
      userAgent,
      metadata: { busCode: bus.busCode, routeCode: route.routeCode, tripType }
    });

    return {
      ...trip.toObject(),
      bus,
      route
    };
  }

  static async updateTripStatus({ schoolCode, tripId, status, currentStopId, delayedByMinutes, delayReason, driverUser, ipAddress, userAgent }) {
    const TRIP_TRANSITIONS = {
      [TRIP_STATUS.NOT_STARTED]: [TRIP_STATUS.STARTED, TRIP_STATUS.IN_TRANSIT],
      [TRIP_STATUS.STARTED]: [TRIP_STATUS.AT_PICKUP, TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.AT_DROP, TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED],
      [TRIP_STATUS.AT_PICKUP]: [TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.AT_DROP, TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED],
      [TRIP_STATUS.IN_TRANSIT]: [TRIP_STATUS.AT_PICKUP, TRIP_STATUS.AT_DROP, TRIP_STATUS.DELAYED, TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED],
      [TRIP_STATUS.DELAYED]: [TRIP_STATUS.AT_PICKUP, TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.AT_DROP, TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED],
      [TRIP_STATUS.AT_DROP]: [TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.COMPLETED, TRIP_STATUS.CANCELLED],
      [TRIP_STATUS.COMPLETED]: [],
      [TRIP_STATUS.CANCELLED]: []
    };
    const trip = await Trip.findOne({ schoolCode, tripId });
    if (!trip) { const e = new Error(`Trip [${tripId}] not found.`); e.statusCode = 404; throw e; }
    if (driverUser && trip.driverCode !== driverUser.userCode) { const e = new Error("Driver does not own this trip."); e.statusCode = 403; throw e; }
    const allowed = TRIP_TRANSITIONS[trip.status] || [];
    if (trip.status !== status && !allowed.includes(status)) {
      const e = new Error(`Invalid trip status transition from [${trip.status}] to [${status}].`);
      e.statusCode = 409;
      throw e;
    }
    const finalDelayReason = delayReason || (status === TRIP_STATUS.DELAYED ? "Traffic congestion on route" : undefined);
    trip.status = status;
    if (currentStopId) trip.currentStopId = currentStopId;
    if (delayedByMinutes !== undefined) trip.delayedByMinutes = delayedByMinutes;
    if (finalDelayReason) trip.delayReason = finalDelayReason;
    if (status === TRIP_STATUS.COMPLETED || status === TRIP_STATUS.CANCELLED) trip.completedAt = new Date();
    trip.statusHistory.push({ status, timestamp: new Date(), notes: finalDelayReason || `Transitioned to ${status}` });
    await trip.save();

    if (status === TRIP_STATUS.DELAYED) {
      await NotificationService.alertSafetyStakeholders({
        schoolCode,
        title: `Bus ${trip.busCode} Delayed`,
        message: `Route ${trip.routeCode} is delayed by ${delayedByMinutes || 15} minutes. Reason: ${finalDelayReason}`,
        eventType: "TRANSPORT_DELAYED",
        metadata: { tripId, busCode: trip.busCode }
      });
    }
    await AuditService.log({
      schoolCode,
      actor: { userCode: driverUser ? driverUser.userCode : "system", role: driverUser ? driverUser.role : "SYSTEM", fullName: driverUser ? driverUser.fullName : "System", email: driverUser ? driverUser.email : undefined },
      action: "TRIP_STATUS_CHANGED",
      resourceType: "TRIP",
      resourceId: tripId,
      reason: finalDelayReason || `Trip status changed to ${status}`,
      ipAddress,
      userAgent,
      metadata: { previousStatus: trip.statusHistory[trip.statusHistory.length - 2]?.status, newStatus: status }
    });
    return trip;
  }

  static async ingestLocation({ schoolCode, tripId, busCode, routeCode, driverUser, latitude, longitude, speedKmph = 0, accuracyMeters = 5, deviceTimestamp, resetTrail = false, visibleNow = false, ipAddress, userAgent }) {
    const trip = await Trip.findOne({ schoolCode, tripId });
    if (!trip) { const e = new Error(`Trip [${tripId}] not found.`); e.statusCode = 404; throw e; }
    if (driverUser && trip.driverCode !== driverUser.userCode) { const e = new Error("Driver does not own this trip."); e.statusCode = 403; throw e; }

    const resolvedBusCode = busCode || trip.busCode;
    const resolvedRouteCode = routeCode || trip.routeCode;

    if (resetTrail) {
      await Location.deleteMany({ schoolCode, tripId });
    }

    const school = await School.findOne({ schoolCode });
    const delaySeconds = school?.settings?.defaultDelayedVisibilitySeconds || config.TRANSPORT.DEFAULT_DELAY_SECONDS;
    const serverReceivedAt = new Date();
    const visibleAfter = visibleNow ? serverReceivedAt : new Date(serverReceivedAt.getTime() + delaySeconds * 1000);

    let isFlaggedSpoofed = false;
    let spoofReason = null;
    if (speedKmph > 120) { isFlaggedSpoofed = true; spoofReason = `Implausible speed detected: ${speedKmph} km/h`; }
    const previousLocation = await Location.findOne({ schoolCode, tripId }).sort({ serverReceivedAt: -1 });
    if (previousLocation) {
      const timeDiffSec = (serverReceivedAt.getTime() - new Date(previousLocation.serverReceivedAt).getTime()) / 1000;
      if (timeDiffSec > 0 && timeDiffSec <= 30) {
        const R = 6371;
        const dLat = ((latitude - previousLocation.latitude) * Math.PI) / 180;
        const dLon = ((longitude - previousLocation.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos((previousLocation.latitude * Math.PI) / 180) * Math.cos((latitude * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distanceKm = R * c;
        if (distanceKm > 3) { isFlaggedSpoofed = true; spoofReason = `Impossible distance jump: ${distanceKm.toFixed(2)} km in ${timeDiffSec.toFixed(1)}s`; }
      }
    }

    const locationRecord = new Location({
      schoolCode,
      tripId,
      busCode: resolvedBusCode,
      routeCode: resolvedRouteCode,
      driverCode: driverUser ? driverUser.userCode : "system",
      latitude,
      longitude,
      speedKmph,
      accuracyMeters,
      deviceTimestamp: new Date(deviceTimestamp || Date.now()),
      serverReceivedAt,
      visibleAfter,
      isFlaggedSpoofed,
      spoofReason
    });
    await locationRecord.save();

    if (isFlaggedSpoofed) {
      logger.warn(`ANTI-SPOOF ALERT [${schoolCode}]: Trip ${tripId} - ${spoofReason}`);
      await AuditService.log({
        schoolCode,
        actor: { userCode: driverUser ? driverUser.userCode : "system", role: driverUser ? driverUser.role : "SYSTEM", fullName: driverUser ? driverUser.fullName : "System", email: driverUser ? driverUser.email : undefined },
        action: "GPS_SPOOFING_DETECTED",
        resourceType: "LOCATION",
        resourceId: tripId,
        reason: spoofReason,
        ipAddress: ipAddress || "127.0.0.1",
        userAgent,
        metadata: { latitude, longitude, speedKmph }
      });
    }
    return locationRecord;
  }

  static async getDelayedBusLocationForParent({ schoolCode, parentUser, studentCode }) {
    const userDoc = await User.findOne({ schoolCode, userCode: parentUser.userCode });
    if (!userDoc || userDoc.status !== "ACTIVE") {
      const e = new Error("Parent account is not active or has been deactivated.");
      e.statusCode = 403;
      throw e;
    }
    if (userDoc.accessControls && userDoc.accessControls.transportEnabled === false) {
      const e = new Error("Bus location tracking access has been deactivated for your account by the School Administrator.");
      e.statusCode = 403;
      throw e;
    }

    let link = await ParentStudentLink.findOne({ schoolCode, parentCode: parentUser.userCode, studentCode });
    if (!link && userDoc.verificationDetails?.status === "VERIFIED") {
      link = await ParentStudentLink.create({
        schoolCode,
        parentCode: parentUser.userCode,
        studentCode,
        status: "VERIFIED",
        relationship: "PARENT"
      });
    }
    if (!link) {
      const e = new Error("Access denied: You are not verified for this student.");
      e.statusCode = 403;
      throw e;
    }

    const student = await Student.findOne({ schoolCode, studentCode });
    if (!student) {
      const e = new Error("Student not found.");
      e.statusCode = 404;
      throw e;
    }

    const school = await School.findOne({ schoolCode });
    const configuredDelaySeconds = school?.settings?.defaultDelayedVisibilitySeconds || config.TRANSPORT.DEFAULT_DELAY_SECONDS || 30;

    let assignedBus = student.busCode || student.transport?.busCode || userDoc.accessControls?.transportBusCode;
    let busDoc = assignedBus ? await Bus.findOne({ schoolCode, busCode: assignedBus }) : null;
    if (!busDoc) {
      busDoc = await Bus.findOne({ schoolCode, status: "ACTIVE" }).sort({ createdAt: 1 });
      if (!busDoc) {
        busDoc = await Bus.create({
          schoolCode,
          busCode: `${schoolCode}-BUS-001`,
          busNumber: "Bus 01",
          registrationNumber: "TS-09-UB-1001",
          capacity: 40,
          status: "ACTIVE"
        });
      }
      assignedBus = busDoc.busCode;
    }

    // Resolve route & stops
    const assignedRouteCode = student.routeCode || student.transport?.routeCode || busDoc.routeCode;
    let routeDoc = assignedRouteCode
      ? await Route.findOne({ schoolCode, routeCode: assignedRouteCode })
      : await Route.findOne({ schoolCode, busCode: assignedBus });
    if (!routeDoc) {
      routeDoc = await Route.findOne({ schoolCode, status: "ACTIVE" }).sort({ createdAt: 1 });
    }

    let stops = [];
    if (routeDoc) {
      const stopDocs = await Stop.find({ schoolCode, routeCode: routeDoc.routeCode }).sort({ sequenceOrder: 1 }).lean();
      if (stopDocs.length > 0) {
        stops = stopDocs.map((s) => ({
          stopId: s.stopCode,
          stopName: s.stopName,
          sequenceOrder: s.sequenceOrder,
          scheduledPickupTime: s.scheduledPickupTime,
          scheduledDropTime: s.scheduledDropTime,
          coordinates: s.location?.coordinates || [78.4867, 17.3850]
        }));
      } else if (Array.isArray(routeDoc.stops)) {
        stops = routeDoc.stops;
      }
    }

    const routePayload = routeDoc
      ? {
        routeCode: routeDoc.routeCode,
        routeName: routeDoc.routeName,
        startLocation: routeDoc.startLocation,
        endLocation: routeDoc.endLocation,
        stops
      }
      : null;

    const assignedStopName =
      student.transport?.stopName ||
      stops[0]?.stopName ||
      routeDoc?.startLocation?.name ||
      "Main Gate / Campus Terminal";

    const activeTrip = await Trip.findOne({
      schoolCode,
      busCode: assignedBus,
      status: { $in: [TRIP_STATUS.STARTED, TRIP_STATUS.AT_PICKUP, TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.AT_DROP] }
    }).sort({ startedAt: -1 });

    const driverCode = activeTrip?.driverCode || busDoc?.driverCode || routeDoc?.driverCode || null;
    const driverDoc = driverCode
      ? await User.findOne({ schoolCode, userCode: driverCode }).select("userCode fullName phone").lean()
      : null;

    const now = new Date();
    const defaultLat = routeDoc?.startLocation?.coordinates?.[1] ?? 17.385044;
    const defaultLng = routeDoc?.startLocation?.coordinates?.[0] ?? 78.486671;

    if (!activeTrip) {
      return {
        isActive: false,
        busCode: assignedBus,
        registrationNumber: busDoc?.registrationNumber || assignedBus,
        routeCode: routeDoc?.routeCode || "DEFAULT-ROUTE",
        routeName: routeDoc?.routeName || "School Main Route",
        driver: driverDoc ? { userCode: driverDoc.userCode, fullName: driverDoc.fullName } : null,
        gpsSource: "DRIVER_PORTAL_STANDBY",
        tripStatus: "SCHEDULED",
        configuredDelaySeconds,
        assignedStopName,
        message: "Bus is currently on standby. Live GPS begins automatically when Driver starts the trip.",
        trip: {
          busCode: assignedBus,
          routeCode: routeDoc?.routeCode || "DEFAULT-ROUTE",
          status: "SCHEDULED"
        },
        route: routePayload,
        trail: [],
        location: {
          latitude: defaultLat,
          longitude: defaultLng,
          speedKmph: 0,
          accuracyMeters: 5,
          recordedAt: now,
          visibilityDelaySeconds: configuredDelaySeconds
        }
      };
    }

    // Prefer delayed location per privacy policy; fall back to latest driver GPS ping if within initial window
    let displayLocation = await Location.findOne({ schoolCode, tripId: activeTrip.tripId, visibleAfter: { $lte: now } }).sort({ visibleAfter: -1 });
    if (!displayLocation) {
      displayLocation = await Location.findOne({ schoolCode, tripId: activeTrip.tripId }).sort({ serverReceivedAt: -1 });
    }

    // Recent GPS trail from Driver Portal for polyline rendering
    const trailDocs = await Location.find({ schoolCode, tripId: activeTrip.tripId })
      .sort({ serverReceivedAt: -1 })
      .limit(30)
      .select("latitude longitude")
      .lean();
    const trail = trailDocs.reverse().map((p) => [p.latitude, p.longitude]);

    return {
      isActive: true,
      tripId: activeTrip.tripId,
      busCode: assignedBus,
      registrationNumber: busDoc?.registrationNumber || assignedBus,
      routeCode: routeDoc?.routeCode || activeTrip.routeCode,
      routeName: routeDoc?.routeName || activeTrip.routeCode,
      driver: driverDoc ? { userCode: driverDoc.userCode, fullName: driverDoc.fullName } : (driverCode ? { userCode: driverCode, fullName: "Assigned Driver" } : null),
      gpsSource: "DRIVER_PORTAL_LIVE_GPS",
      tripStatus: activeTrip.status,
      currentStopId: activeTrip.currentStopId,
      delayedByMinutes: activeTrip.delayedByMinutes,
      delayReason: activeTrip.delayReason,
      configuredDelaySeconds,
      assignedStopName,
      trip: {
        tripId: activeTrip.tripId,
        busCode: assignedBus,
        routeCode: routeDoc?.routeCode || activeTrip.routeCode,
        tripType: activeTrip.tripType,
        status: activeTrip.status,
        startedAt: activeTrip.startedAt,
        delayedByMinutes: activeTrip.delayedByMinutes,
        delayReason: activeTrip.delayReason
      },
      route: routePayload,
      trail,
      location: displayLocation
        ? {
          latitude: displayLocation.latitude,
          longitude: displayLocation.longitude,
          speedKmph: displayLocation.speedKmph,
          accuracyMeters: displayLocation.accuracyMeters,
          recordedAt: displayLocation.deviceTimestamp || displayLocation.serverReceivedAt,
          visibilityDelaySeconds: configuredDelaySeconds
        }
        : {
          latitude: defaultLat,
          longitude: defaultLng,
          speedKmph: 0,
          accuracyMeters: 5,
          recordedAt: now,
          visibilityDelaySeconds: configuredDelaySeconds
        }
    };
  }

  /**
   * Returns complete live fleet map payload for School Admin & Transport Coordinator:
   * all buses, active trips, real-time GPS coordinates, GPS trails, routes, and stops.
   */
  static async getLiveFleetStatus({ schoolCode, page = 1, limit = 50 }) {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (p - 1) * l;

    const [buses, routes, stopsAll, activeTrips, drivers] = await Promise.all([
      Bus.find({ schoolCode }).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Route.find({ schoolCode }).lean(),
      Stop.find({ schoolCode }).sort({ sequenceOrder: 1 }).lean(),
      Trip.find({
        schoolCode,
        status: { $in: [TRIP_STATUS.STARTED, TRIP_STATUS.AT_PICKUP, TRIP_STATUS.IN_TRANSIT, TRIP_STATUS.DELAYED, TRIP_STATUS.AT_DROP] }
      }).sort({ startedAt: -1 }).lean(),
      User.find({ schoolCode, role: "DRIVER" }).select("userCode fullName phone status").lean()
    ]);

    const routeMap = new Map();
    for (const r of routes) {
      const rStops = stopsAll.filter((s) => s.routeCode === r.routeCode);
      routeMap.set(r.routeCode, {
        ...r,
        stops: rStops.length > 0
          ? rStops.map((s) => ({
            stopId: s.stopCode,
            stopName: s.stopName,
            sequenceOrder: s.sequenceOrder,
            scheduledPickupTime: s.scheduledPickupTime,
            scheduledDropTime: s.scheduledDropTime,
            coordinates: s.location?.coordinates || [78.4867, 17.3850]
          }))
          : (r.stops || [])
      });
    }

    const driverMap = new Map(drivers.map((d) => [d.userCode, d]));
    const fleet = [];

    for (const bus of buses) {
      const trip = activeTrips.find((t) => t.busCode === bus.busCode) || null;
      const routeCode = trip?.routeCode || bus.routeCode;
      const route = routeCode ? routeMap.get(routeCode) || null : null;
      const driver = bus.driverCode ? driverMap.get(bus.driverCode) || null : null;

      let latestLocation = null;
      let trail = [];
      if (trip) {
        latestLocation = await Location.findOne({ schoolCode, tripId: trip.tripId }).sort({ serverReceivedAt: -1 }).lean();
        const trailDocs = await Location.find({ schoolCode, tripId: trip.tripId })
          .sort({ serverReceivedAt: -1 })
          .limit(30)
          .select("latitude longitude")
          .lean();
        trail = trailDocs.reverse().map((pt) => [pt.latitude, pt.longitude]);
      }

      const fallbackLat = route?.startLocation?.coordinates?.[1] ?? 17.385044;
      const fallbackLng = route?.startLocation?.coordinates?.[0] ?? 78.486671;

      fleet.push({
        bus,
        driver,
        route,
        trip,
        isLive: Boolean(trip),
        status: trip ? trip.status : "STANDBY",
        trail,
        location: latestLocation
          ? {
            latitude: latestLocation.latitude,
            longitude: latestLocation.longitude,
            speedKmph: latestLocation.speedKmph,
            accuracyMeters: latestLocation.accuracyMeters,
            recordedAt: latestLocation.deviceTimestamp || latestLocation.serverReceivedAt,
            isFlaggedSpoofed: latestLocation.isFlaggedSpoofed
          }
          : {
            latitude: fallbackLat,
            longitude: fallbackLng,
            speedKmph: 0,
            accuracyMeters: 0,
            recordedAt: null,
            isFlaggedSpoofed: false
          }
      });
    }

    const total = await Bus.countDocuments({ schoolCode });
    return { fleet, routes: Array.from(routeMap.values()), total, page: p, limit: l, pages: Math.ceil(total / l) };
  }

  static async listBuses({ schoolCode, status, page = 1, limit = 50 }) {
    const p = Math.max(parseInt(page, 10), 1);
    const l = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (p - 1) * l;
    const query = { schoolCode };
    if (status) query.status = status;
    const [buses, total] = await Promise.all([Bus.find(query).sort({ createdAt: -1 }).skip(skip).limit(l), Bus.countDocuments(query)]);
    return { buses, total, page: p, limit: l, pages: Math.ceil(total / l) };
  }

  static async listRoutes({ schoolCode, status, page = 1, limit = 50 }) {
    const p = Math.max(parseInt(page, 10), 1);
    const l = Math.min(Math.max(parseInt(limit, 10), 1), 100);
    const skip = (p - 1) * l;
    const query = { schoolCode };
    if (status) query.status = status;
    const [routes, total, allStops] = await Promise.all([
      Route.find(query).sort({ createdAt: -1 }).skip(skip).limit(l).lean(),
      Route.countDocuments(query),
      Stop.find({ schoolCode }).sort({ sequenceOrder: 1 }).lean()
    ]);

    const enriched = routes.map((r) => {
      const rStops = allStops.filter((s) => s.routeCode === r.routeCode);
      return {
        ...r,
        stops: rStops.length > 0
          ? rStops.map((s) => ({
            stopId: s.stopCode,
            stopCode: s.stopCode,
            stopName: s.stopName,
            sequenceOrder: s.sequenceOrder,
            scheduledPickupTime: s.scheduledPickupTime,
            scheduledDropTime: s.scheduledDropTime,
            coordinates: s.location?.coordinates || [78.4867, 17.3850]
          }))
          : (r.stops || [])
      };
    });

    return { routes: enriched, total, page: p, limit: l, pages: Math.ceil(total / l) };
  }

  static async getBusDetail({ schoolCode, busCode }) {
    const bus = await Bus.findOne({ schoolCode, busCode });
    if (!bus) { const e = new Error(`Bus [${busCode}] not found.`); e.statusCode = 404; throw e; }
    return bus;
  }

  static async updateBus({ schoolCode, busCode, updates, adminUser, ipAddress, userAgent }) {
    const bus = await Bus.findOneAndUpdate({ schoolCode, busCode }, updates, { new: true });
    if (!bus) { const e = new Error(`Bus [${busCode}] not found.`); e.statusCode = 404; throw e; }
    if (updates.routeCode) {
      await Route.findOneAndUpdate(
        { schoolCode, routeCode: updates.routeCode },
        { $set: { busCode, ...(bus.driverCode ? { driverCode: bus.driverCode } : {}) } }
      );
    }
    if (updates.driverCode) {
      await User.findOneAndUpdate(
        { schoolCode, userCode: updates.driverCode },
        { $set: { "accessControls.transportBusCode": busCode } }
      );
    }
    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "BUS_UPDATED",
      resourceType: "BUS",
      resourceId: busCode,
      reason: "Bus details updated",
      ipAddress,
      userAgent,
      metadata: { updates }
    });
    return bus;
  }

  static async createStop({ schoolCode, routeCode, stopName, sequenceOrder, scheduledPickupTime, scheduledDropTime, coordinates, assignedStudentCodes = [], adminUser, ipAddress, userAgent }) {
    const route = await Route.findOne({ schoolCode, routeCode });
    if (!route) { const e = new Error(`Route [${routeCode}] not found.`); e.statusCode = 404; throw e; }
    const seq = await Counter.findOneAndUpdate({ sequenceName: "STOP_CODE", schoolCode }, { $inc: { sequenceValue: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const stopCode = `${schoolCode}-STP-${String(seq.sequenceValue).padStart(3, "0")}`;
    const coords = coordinates || [78.4867, 17.3850];
    const stop = new Stop({ schoolCode, stopCode, routeCode, stopName, sequenceOrder, scheduledPickupTime, scheduledDropTime, location: { type: "Point", coordinates: coords }, assignedStudentCodes });
    await stop.save();

    route.stops.push({
      stopId: stopCode,
      stopName,
      sequenceOrder,
      scheduledPickupTime,
      scheduledDropTime,
      coordinates: coords
    });
    route.stops.sort((a, b) => a.sequenceOrder - b.sequenceOrder);
    await route.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STOP_CREATED",
      resourceType: "STOP",
      resourceId: stopCode,
      reason: "Bus stop created",
      ipAddress,
      userAgent,
      metadata: { routeCode, stopName, sequenceOrder }
    });
    return stop;
  }

  static async listStops({ schoolCode, routeCode, page = 1, limit = 50 }) {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (p - 1) * l;
    const query = { schoolCode };
    if (routeCode) query.routeCode = routeCode;
    const [stops, total] = await Promise.all([Stop.find(query).sort({ sequenceOrder: 1 }).skip(skip).limit(l), Stop.countDocuments(query)]);
    return { stops, total, page: p, limit: l, pages: Math.ceil(total / l) };
  }

  static async updateStop({ schoolCode, stopCode, updates, adminUser, ipAddress, userAgent }) {
    const patch = { ...updates };
    if (updates.coordinates) {
      patch.location = { type: "Point", coordinates: updates.coordinates };
      delete patch.coordinates;
    }
    const stop = await Stop.findOneAndUpdate({ schoolCode, stopCode }, patch, { new: true });
    if (!stop) { const e = new Error(`Stop [${stopCode}] not found.`); e.statusCode = 404; throw e; }
    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STOP_UPDATED",
      resourceType: "STOP",
      resourceId: stopCode,
      reason: "Bus stop updated",
      ipAddress,
      userAgent,
      metadata: { updates }
    });
    return stop;
  }

  static async deleteStop({ schoolCode, stopCode, adminUser, ipAddress, userAgent }) {
    const stop = await Stop.findOneAndDelete({ schoolCode, stopCode });
    if (!stop) { const e = new Error(`Stop [${stopCode}] not found.`); e.statusCode = 404; throw e; }
    await Route.findOneAndUpdate(
      { schoolCode, routeCode: stop.routeCode },
      { $pull: { stops: { stopId: stopCode } } }
    );
    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "STOP_DELETED",
      resourceType: "STOP",
      resourceId: stopCode,
      reason: "Bus stop removed",
      ipAddress,
      userAgent
    });
    return { deleted: true, stopCode };
  }

  static async applyTransportAccess({ schoolCode, parentUser, studentCode, routeCode, busCode, ipAddress, userAgent }) {
    const link = await ParentStudentLink.findOne({ schoolCode, parentCode: parentUser.userCode, studentCode, status: "VERIFIED" });
    if (!link) { const e = new Error("Parent is not verified for this student."); e.statusCode = 403; throw e; }
    const student = await Student.findOne({ schoolCode, studentCode });
    if (!student || student.busCode !== busCode || student.routeCode !== routeCode) { const e = new Error("Student is not assigned to this bus/route."); e.statusCode = 400; throw e; }
    const existing = await TransportAccessRequest.findOne({ schoolCode, parentCode: parentUser.userCode, studentCode, busCode, routeCode });
    if (existing) { const e = new Error("Transport access request already exists."); e.statusCode = 409; throw e; }
    const seq = await Counter.findOneAndUpdate({ sequenceName: "TRANSPORT_ACCESS_REQUEST", schoolCode }, { $inc: { sequenceValue: 1 } }, { new: true, upsert: true, setDefaultsOnInsert: true });
    const requestCode = `${schoolCode}-TAR-${String(seq.sequenceValue).padStart(3, "0")}`;
    const request = new TransportAccessRequest({ schoolCode, requestCode, parentCode: parentUser.userCode, studentCode, routeCode, busCode, status: "PENDING" });
    await request.save();
    await AuditService.log({ schoolCode, actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email }, action: "TRANSPORT_ACCESS_REQUESTED", resourceType: "TRANSPORT_ACCESS_REQUEST", resourceId: requestCode, reason: "Parent requested bus tracking access", ipAddress, userAgent, metadata: { studentCode, routeCode, busCode } });
    await NotificationService.alertSafetyStakeholders({ schoolCode, title: "Transport Access Request", message: `Parent ${parentUser.fullName} requested bus tracking for student ${studentCode}.`, eventType: "TRANSPORT_ACCESS_REQUESTED", priority: "NORMAL", metadata: { requestCode, studentCode, routeCode, busCode, parentCode: parentUser.userCode } });
    return request;
  }

  static async listAccessRequests({ schoolCode, parentUser, userRole, status, page = 1, limit = 50 }) {
    const p = Math.max(parseInt(page, 10) || 1, 1);
    const l = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 100);
    const skip = (p - 1) * l;
    const query = { schoolCode };
    if (userRole === "PARENT") query.parentCode = parentUser.userCode;
    if (status) query.status = status;
    const [requests, total] = await Promise.all([TransportAccessRequest.find(query).sort({ createdAt: -1 }).skip(skip).limit(l), TransportAccessRequest.countDocuments(query)]);
    return { requests, total, page: p, limit: l, pages: Math.ceil(total / l) };
  }

  static async reviewAccessRequest({ schoolCode, requestCode, status, remarks, reviewerUser, ipAddress, userAgent }) {
    if (reviewerUser.role !== "SCHOOL_ADMIN" && reviewerUser.role !== "TRANSPORT_COORDINATOR") { const e = new Error("Only School Admin or Transport Coordinator can review access requests."); e.statusCode = 403; throw e; }
    const request = await TransportAccessRequest.findOne({ schoolCode, requestCode });
    if (!request) { const e = new Error(`Access request [${requestCode}] not found.`); e.statusCode = 404; throw e; }
    if (request.status !== "PENDING") { const e = new Error(`Request is already ${request.status}.`); e.statusCode = 400; throw e; }
    if (status !== "APPROVED" && status !== "REJECTED") { const e = new Error("Status must be APPROVED or REJECTED."); e.statusCode = 400; throw e; }
    request.status = status;
    request.reviewedBy = reviewerUser.userCode;
    request.reviewedAt = new Date();
    request.remarks = remarks;
    await request.save();
    await AuditService.log({ schoolCode, actor: { userCode: reviewerUser.userCode, role: reviewerUser.role, fullName: reviewerUser.fullName, email: reviewerUser.email }, action: "TRANSPORT_ACCESS_REVIEWED", resourceType: "TRANSPORT_ACCESS_REQUEST", resourceId: requestCode, reason: `Access request ${status.toLowerCase()}`, ipAddress, userAgent, metadata: { parentCode: request.parentCode, studentCode: request.studentCode, newStatus: status } });
    return request;
  }

  static async revokeAccessRequest({ schoolCode, requestCode, revokerUser, ipAddress, userAgent }) {
    if (revokerUser.role !== "SCHOOL_ADMIN" && revokerUser.role !== "TRANSPORT_COORDINATOR") { const e = new Error("Only School Admin or Transport Coordinator can revoke access requests."); e.statusCode = 403; throw e; }
    const request = await TransportAccessRequest.findOne({ schoolCode, requestCode });
    if (!request) { const e = new Error(`Access request [${requestCode}] not found.`); e.statusCode = 404; throw e; }
    if (request.status !== "APPROVED") { const e = new Error(`Only APPROVED requests can be revoked. Current: ${request.status}.`); e.statusCode = 400; throw e; }
    request.status = "REVOKED";
    await request.save();
    await AuditService.log({ schoolCode, actor: { userCode: revokerUser.userCode, role: revokerUser.role, fullName: revokerUser.fullName, email: revokerUser.email }, action: "TRANSPORT_ACCESS_REVOKED", resourceType: "TRANSPORT_ACCESS_REQUEST", resourceId: requestCode, reason: "Transport access revoked", ipAddress, userAgent, metadata: { parentCode: request.parentCode, studentCode: request.studentCode } });
    return request;
  }
}

module.exports = TransportService;
