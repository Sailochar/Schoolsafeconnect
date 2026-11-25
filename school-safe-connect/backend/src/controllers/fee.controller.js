/**
 * Fee Controller
 */

const FeeService = require("../services/fee.service");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class FeeController {
  static _ctx(req) {
    return {
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.headers["user-agent"] || "unknown"
    };
  }

  static async listFees(req, res, next) {
    try {
      const { classCode, status, studentCode, search, page, limit } = req.query;
      const result = await FeeService.listFees({
        schoolCode: req.tenantSchoolCode,
        classCode,
        status,
        studentCode,
        search,
        page,
        limit
      });
      return sendSuccess(res, "Fee records retrieved.", result);
    } catch (err) {
      next(err);
    }
  }

  static async getStats(req, res, next) {
    try {
      const stats = await FeeService.getStats({ schoolCode: req.tenantSchoolCode });
      return sendSuccess(res, "Fee statistics retrieved.", stats);
    } catch (err) {
      next(err);
    }
  }

  static async createFee(req, res, next) {
    try {
      const { studentCode, classCode, feeType, amount, dueDate, notes } = req.body;
      const { ipAddress, userAgent } = FeeController._ctx(req);
      const records = await FeeService.createFee({
        schoolCode: req.tenantSchoolCode,
        studentCode,
        classCode,
        feeType,
        amount,
        dueDate,
        notes,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendCreated(res, `Fee assigned successfully (${records.length} record(s)).`, { count: records.length, records });
    } catch (err) {
      next(err);
    }
  }

  static async recordPayment(req, res, next) {
    try {
      const { paidAmount, paymentMethod, transactionRef, notes } = req.body;
      const { ipAddress, userAgent } = FeeController._ctx(req);
      const updatedFee = await FeeService.recordPayment({
        schoolCode: req.tenantSchoolCode,
        feeId: req.params.id,
        paidAmount,
        paymentMethod,
        transactionRef,
        notes,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "Fee payment recorded and receipt generated.", updatedFee);
    } catch (err) {
      next(err);
    }
  }

  static async remindWhatsApp(req, res, next) {
    try {
      const { ipAddress, userAgent } = FeeController._ctx(req);
      const result = await FeeService.sendWhatsAppReminder({
        schoolCode: req.tenantSchoolCode,
        feeId: req.params.id,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, "WhatsApp fee reminder dispatched to parent.", result);
    } catch (err) {
      next(err);
    }
  }

  static async remindAllWhatsApp(req, res, next) {
    try {
      const { classCode } = req.body || {};
      const { ipAddress, userAgent } = FeeController._ctx(req);
      const result = await FeeService.sendAllWhatsAppReminders({
        schoolCode: req.tenantSchoolCode,
        classCode,
        adminUser: req.user,
        ipAddress,
        userAgent
      });
      return sendSuccess(res, `Dispatched WhatsApp reminders to ${result.sentCount} parents.`, result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = FeeController;
