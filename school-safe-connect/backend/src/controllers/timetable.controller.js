/**
 * Timetable Controller
 */

const TimetableService = require("../services/timetable.service");
const { sendSuccess, sendCreated } = require("../utils/response");

class TimetableController {
  static async getClassTimetable(req, res, next) {
    try {
      const result = await TimetableService.getClassTimetable({
        schoolCode: req.tenantSchoolCode,
        classCode: req.params.classCode
      });
      return sendSuccess(res, "Class timetable retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async saveClassDayTimetable(req, res, next) {
    try {
      const { dayOfWeek, sessions, academicYear } = req.body || {};
      const doc = await TimetableService.saveClassDayTimetable({
        schoolCode: req.tenantSchoolCode,
        classCode: req.params.classCode,
        dayOfWeek,
        sessions,
        academicYear,
        adminUser: req.user,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendSuccess(res, `Timetable saved for ${req.params.classCode} (${dayOfWeek}).`, doc);
    } catch (err) {
      next(err);
    }
  }

  static async generateWeeklyTimetable(req, res, next) {
    try {
      const { startTime, periodMinutes, periodsPerDay, includeCurrentTimeSession, days } = req.body || {};
      const result = await TimetableService.generateWeeklyTimetable({
        schoolCode: req.tenantSchoolCode,
        classCode: req.params.classCode,
        startTime,
        periodMinutes,
        periodsPerDay,
        includeCurrentTimeSession,
        days,
        adminUser: req.user,
        ipAddress: req.ip || req.connection?.remoteAddress,
        userAgent: req.headers["user-agent"] || "unknown"
      });
      return sendCreated(res, `Weekly timetable generated for ${req.params.classCode}.`, result);
    } catch (err) {
      next(err);
    }
  }

  static async getMySchedule(req, res, next) {
    try {
      const result = await TimetableService.getMySchedule({
        schoolCode: req.tenantSchoolCode,
        user: req.user
      });
      return sendSuccess(res, "Personal timetable retrieved.", result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = TimetableController;
