/**
 * CCTV Controller
 */

const CctvService = require("../services/cctv.service");
const { Camera, CctvAccessRequest } = require("../models");
const { sendSuccess, sendCreated } = require("../utils/response");

class CctvController {
  static async registerCamera(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const camera = await CctvService.registerCamera({
        schoolCode: req.tenantSchoolCode,
        name: req.body.name,
        location: req.body.location,
        classCode: req.body.classCode,
        rtspUrl: req.body.rtspUrl,
        privacyZone: req.body.privacyZone,
        streamChannelKey: req.body.streamChannelKey,
        adminUser: req.user,
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Camera registered successfully.", camera);
    } catch (err) {
      next(err);
    }
  }

  static async listCameras(req, res, next) {
    try {
      const cameras = await Camera.find({ schoolCode: req.tenantSchoolCode }).select("-rtspUrl");
      return sendSuccess(res, "Cameras retrieved.", { cameras, count: cameras.length });
    } catch (err) {
      next(err);
    }
  }

  static async requestAccess(req, res, next) {
    try {
      const request = await CctvService.requestCctvAccess({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        studentCode: req.body.studentCode,
        cameraCode: req.body.cameraCode,
        validForDate: req.body.validForDate
      });

      return sendCreated(res, "CCTV access request submitted for teacher review.", request);
    } catch (err) {
      next(err);
    }
  }

  static async reviewRequest(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const request = await CctvService.reviewCctvRequest({
        schoolCode: req.tenantSchoolCode,
        requestCode: req.params.requestCode,
        status: req.body.status, // APPROVED or REJECTED
        rejectionReason: req.body.rejectionReason,
        reviewerUser: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, `CCTV access request ${req.body.status.toLowerCase()}.`, request);
    } catch (err) {
      next(err);
    }
  }

  static async listPendingRequests(req, res, next) {
    try {
      const query = { schoolCode: req.tenantSchoolCode, status: "PENDING" };
      if (req.user.role === "CLASS_TEACHER") {
        query.classCode = req.query.classCode;
      }
      const requests = await CctvAccessRequest.find(query).sort({ requestedAt: -1 });
      return sendSuccess(res, "Pending CCTV access requests retrieved.", { requests, count: requests.length });
    } catch (err) {
      next(err);
    }
  }

  static async startSession(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const session = await CctvService.initiateLiveStreamSession({
        schoolCode: req.tenantSchoolCode,
        parentUser: req.user,
        studentCode: req.body.studentCode,
        cameraCode: req.body.cameraCode,
        deviceDetails: req.body.deviceDetails || {},
        ipAddress,
        userAgent
      });

      return sendCreated(res, "Live CCTV session initialized with dynamic forensic watermark.", session);
    } catch (err) {
      next(err);
    }
  }

  static async endSession(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await CctvService.terminateSession({
        schoolCode: req.tenantSchoolCode,
        sessionId: req.params.sessionId,
        endReason: req.body.endReason || "USER_CLOSED",
        user: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Live CCTV session terminated.", result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = CctvController;
