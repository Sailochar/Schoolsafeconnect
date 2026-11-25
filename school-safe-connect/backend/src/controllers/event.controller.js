/**
 * Event Controller
 */

const EventService = require("../services/event.service");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class EventController {
  static _ctx(req) {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"] || "unknown"
    };
  }

  static async listEvents(req, res, next) {
    try {
      const events = await EventService.listEvents({ schoolCode: req.tenantSchoolCode });
      return sendSuccess(res, "Active school events retrieved.", { events, count: events.length });
    } catch (err) {
      next(err);
    }
  }

  static async createEvent(req, res, next) {
    try {
      const { title, description, category, eventDate, images } = req.body;
      const { ipAddress, userAgent } = EventController._ctx(req);
      const newEvent = await EventService.createEvent({
        schoolCode: req.tenantSchoolCode,
        title,
        description,
        category,
        eventDate,
        images,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendCreated(res, "Event published to school gallery (valid for 7 days).", newEvent);
    } catch (err) {
      next(err);
    }
  }

  static async deleteEvent(req, res, next) {
    try {
      const { ipAddress, userAgent } = EventController._ctx(req);
      const result = await EventService.deleteEvent({
        schoolCode: req.tenantSchoolCode,
        eventId: req.params.id,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Event removed from gallery.", result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = EventController;
