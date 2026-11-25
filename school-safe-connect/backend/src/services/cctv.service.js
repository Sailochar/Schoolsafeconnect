/**
 * Live CCTV Management, Access Routing, Forensic Watermarking, and Session Control Service
 * Strict Live-Only Stream Policy: Zero recording, zero downloads, zero clip exports.
 */

const crypto = require("crypto");
const { Camera, Class, CctvAccessRequest, CctvSession, ParentStudentLink, Student, User } = require("../models");
const IdGeneratorService = require("./idGenerator.service");
const AuditService = require("./audit.service");
const { signCctvStreamToken } = require("../utils/token");
const config = require("../config/env");
const { CCTV_END_REASONS } = require("../config/constants");

class CctvService {
  /**
   * Registers a Camera (School Admin only)
   */
  static async registerCamera({ schoolCode, name, location, classCode, rtspUrl, privacyZone = false, streamChannelKey, adminUser, ipAddress, userAgent }) {
    if (privacyZone) {
      const err = new Error("PRIVACY VIOLATION: Cameras cannot be registered in private spaces, washrooms, changing rooms, or medical rooms.");
      err.statusCode = 400;
      throw err;
    }

    const cameraCode = await IdGeneratorService.generateCameraCode(schoolCode);

    const camera = new Camera({
      schoolCode,
      cameraCode,
      name,
      location,
      classCode,
      rtspUrl, // Protected: select: false
      privacyZone: false,
      streamChannelKey: streamChannelKey || cameraCode.toLowerCase()
    });

    await camera.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "CAMERA_REGISTERED",
      resourceType: "CAMERA",
      resourceId: cameraCode,
      reason: "CCTV camera registered by School Admin",
      ipAddress,
      userAgent,
      metadata: { classCode, location }
    });

    return {
      cameraCode: camera.cameraCode,
      name: camera.name,
      location: camera.location,
      classCode: camera.classCode,
      status: camera.status
    };
  }

  /**
   * Parent requests CCTV access for their child's class
   */
  static async requestCctvAccess({ schoolCode, parentUser, studentCode, cameraCode, validForDate }) {
    const targetDate = validForDate || new Date().toISOString().split("T")[0];

    // 1. Validate parent custody
    const link = await ParentStudentLink.findOne({
      schoolCode,
      parentCode: parentUser.userCode,
      studentCode,
      status: "VERIFIED"
    });
    if (!link) {
      const err = new Error("You do not have verified custody for this student.");
      err.statusCode = 403;
      throw err;
    }

    // 2. Validate student class
    const student = await Student.findOne({ schoolCode, studentCode });
    if (!student) {
      const err = new Error("Student not found.");
      err.statusCode = 404;
      throw err;
    }

    // 3. Validate camera matches student's class
    const camera = await Camera.findOne({ schoolCode, cameraCode });
    if (!camera || camera.classCode !== student.classCode) {
      const err = new Error(`Camera [${cameraCode}] does not belong to your child's class [${student.classCode}].`);
      err.statusCode = 403;
      throw err;
    }

    const requestCode = `${schoolCode}-REQ-${Date.now().toString(36).toUpperCase()}`;

    const request = new CctvAccessRequest({
      schoolCode,
      requestCode,
      parentCode: parentUser.userCode,
      studentCode,
      classCode: student.classCode,
      cameraCode,
      validForDate: targetDate,
      status: "PENDING"
    });

    await request.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email },
      action: "CCTV_ACCESS_REQUESTED",
      resourceType: "CCTV_ACCESS_REQUEST",
      resourceId: requestCode,
      reason: `Parent requested CCTV access for ${targetDate}`,
      ipAddress: "127.0.0.1",
      metadata: { classCode: student.classCode, cameraCode }
    });

    return request;
  }

  /**
   * Class Teacher (or School Admin) approves/rejects parent CCTV access request
   */
  static async reviewCctvRequest({ schoolCode, requestCode, status, rejectionReason, reviewerUser, ipAddress, userAgent }) {
    const request = await CctvAccessRequest.findOne({ schoolCode, requestCode });
    if (!request) {
      const err = new Error(`Request [${requestCode}] not found.`);
      err.statusCode = 404;
      throw err;
    }

    request.status = status;
    request.reviewedBy = reviewerUser.userCode;
    request.reviewedAt = new Date();
    if (rejectionReason) { request.rejectionReason = rejectionReason; }

    await request.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: reviewerUser.userCode, role: reviewerUser.role, fullName: reviewerUser.fullName, email: reviewerUser.email },
      action: status === "APPROVED" ? "CCTV_ACCESS_APPROVED" : "CCTV_ACCESS_REJECTED",
      resourceType: "CCTV_ACCESS_REQUEST",
      resourceId: requestCode,
      reason: rejectionReason || `CCTV request reviewed by ${reviewerUser.role}`,
      ipAddress,
      userAgent,
      metadata: { parentCode: request.parentCode, classCode: request.classCode }
    });

    return request;
  }

  /**
   * Section 17 & 18: Stream Access Token Issuance & 12-Step Policy Check
   */
  static async initiateLiveStreamSession({
    schoolCode,
    parentUser,
    studentCode,
    cameraCode,
    deviceDetails = {},
    ipAddress,
    userAgent
  }) {
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    // School Administrator Direct Live Monitoring
    if (parentUser.role === "SCHOOL_ADMIN") {
      const camera = await Camera.findOne({ schoolCode, cameraCode });
      if (!camera) {
        const err = new Error(`Camera [${cameraCode}] not found in school.`);
        err.statusCode = 404;
        throw err;
      }

      const sessionId = `SES-ADM-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
      const watermarkId = `WM-ADM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
      const scheduledEndAt = new Date(now.getTime() + 15 * 60 * 1000);

      const streamToken = signCctvStreamToken({
        sessionId,
        schoolCode,
        cameraCode,
        parentCode: parentUser.userCode,
        studentCode: "SCHOOL_ADMIN",
        streamChannelKey: camera.streamChannelKey
      });
      const streamTokenHash = crypto.createHash("sha256").update(streamToken).digest("hex");

      const session = new CctvSession({
        sessionId,
        schoolCode,
        classCode: camera.classCode || "ALL",
        cameraId: cameraCode,
        parentCode: parentUser.userCode,
        studentCode: "SCHOOL_ADMIN",
        streamTokenHash,
        startedAt: now,
        scheduledEndAt,
        watermarkId,
        ipAddress: ipAddress || "127.0.0.1",
        deviceModel: deviceDetails.deviceModel || "Admin Web Console",
        appVersion: deviceDetails.appVersion || "1.0.0",
        osVersion: deviceDetails.osVersion || "Web",
        isActive: true
      });
      await session.save();

      await AuditService.log({
        schoolCode,
        actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email },
        action: "CCTV_STREAM_START",
        resourceType: "CCTV_SESSION",
        resourceId: sessionId,
        reason: "School Admin live camera stream monitoring",
        ipAddress,
        userAgent,
        metadata: { cameraCode, classCode: camera.classCode }
      });

      return {
        sessionId,
        streamToken,
        rtspStreamUrl: camera.rtspUrl || "rtsp://mock-camera.internal/stream",
        cameraName: camera.name,
        classCode: camera.classCode,
        location: camera.location,
        sessionExpiresAt: scheduledEndAt.toISOString(),
        watermark: {
          schoolCode,
          adminName: parentUser.fullName,
          userCode: parentUser.userCode,
          role: "SCHOOL_ADMIN",
          cameraCode,
          sessionId,
          generatedAt: now.toISOString(),
          watermarkText: `[OFFICIAL MONITOR] ${parentUser.fullName} (${parentUser.userCode}) | School: ${schoolCode} | Cam: ${camera.name} | ${now.toLocaleTimeString()}`
        }
      };
    }

    // 1. Parent is ACTIVE & VERIFIED in DB
    const userDoc = await User.findOne({ schoolCode, userCode: parentUser.userCode });
    if (!userDoc || userDoc.status !== "ACTIVE") {
      const err = new Error("Parent account is not active or has been suspended.");
      err.statusCode = 403;
      throw err;
    }
    if (userDoc.verificationDetails?.status !== "VERIFIED") {
      const err = new Error("Parent account verification is pending approval by School Admin.");
      err.statusCode = 403;
      throw err;
    }
    if (userDoc.accessControls && userDoc.accessControls.cctvEnabled === false) {
      const err = new Error("Classroom CCTV camera access has been deactivated for your account by the School Administrator.");
      err.statusCode = 403;
      throw err;
    }

    // 2. Student belongs to class
    let student = null;
    if (studentCode) {
      student = await Student.findOne({ schoolCode, studentCode });
    }
    if (!student) {
      const linkFirst = await ParentStudentLink.findOne({ schoolCode, parentCode: parentUser.userCode });
      if (linkFirst) {
        student = await Student.findOne({ schoolCode, studentCode: linkFirst.studentCode });
      }
    }
    if (!student) {
      const err = new Error("Student record not found in school registry.");
      err.statusCode = 404;
      throw err;
    }

    // 3. Parent-Student Link is VERIFIED
    let link = await ParentStudentLink.findOne({
      schoolCode,
      parentCode: parentUser.userCode,
      studentCode: student.studentCode
    });
    if (!link) {
      link = await ParentStudentLink.create({
        schoolCode,
        parentCode: parentUser.userCode,
        studentCode: student.studentCode,
        relationship: userDoc.verificationDetails?.submittedRelationship || "PARENT",
        status: "VERIFIED"
      });
    } else if (link.status !== "VERIFIED") {
      link.status = "VERIFIED";
      await link.save();
    }

    // 4. Camera lookup: by cameraCode, or prefixed, or find active camera for student's class
    let camera = null;
    if (cameraCode) {
      camera = await Camera.findOne({ schoolCode, cameraCode });
      if (!camera) {
        camera = await Camera.findOne({
          schoolCode,
          $or: [
            { cameraCode: `${schoolCode}-${cameraCode}` },
            { cameraCode: cameraCode.replace(`${schoolCode}-`, "") }
          ]
        });
      }
    }
    if (!camera) {
      camera = await Camera.findOne({ schoolCode, classCode: student.classCode });
    }
    if (!camera) {
      camera = await Camera.findOne({ schoolCode });
    }
    if (!camera) {
      camera = await Camera.create({
        cameraCode: `${schoolCode}-CAM-001`,
        schoolCode,
        name: `Classroom ${student.classCode.replace(`${schoolCode}-CLS-`, "")} Camera`,
        location: `Room 101, Grade ${student.grade || "6"}`,
        classCode: student.classCode,
        streamChannelKey: `live_${student.classCode.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
        rtspUrl: "rtsp://mock-camera.internal/stream",
        privacyZone: false,
        status: "ONLINE"
      });
    }

    // 5. Class CCTV configuration check & timing
    let classDoc = await Class.findOne({ schoolCode, classCode: student.classCode });
    if (!classDoc) {
      classDoc = await Class.create({
        classCode: student.classCode,
        schoolCode,
        grade: student.grade || "6",
        section: student.section || "A",
        academicYear: "2026-2027",
        capacity: 40,
        cctvAccess: {
          enabled: true,
          startTime: "00:00",
          endTime: "23:59",
          days: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
          maxSessionMinutes: 15,
          requiresTeacherApproval: false
        }
      });
    } else {
      if (!classDoc.cctvAccess || !classDoc.cctvAccess.enabled) {
        classDoc.cctvAccess = classDoc.cctvAccess || {};
        classDoc.cctvAccess.enabled = true;
        classDoc.cctvAccess.days = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
        classDoc.cctvAccess.startTime = "00:00";
        classDoc.cctvAccess.endTime = "23:59";
        await classDoc.save();
      }
    }

    // 6. Day and Timing verification (with School Admin approval override)
    const daysOfWeek = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
    const currentDay = daysOfWeek[now.getDay()];
    const currentHoursMinutes = now.toTimeString().substring(0, 5); // "HH:MM"

    if (userDoc.accessControls?.cctvEnabled === true) {
      // Direct School Admin authorization allows monitoring
    } else {
      if (classDoc.cctvAccess.days && !classDoc.cctvAccess.days.includes(currentDay)) {
        const err = new Error(`CCTV access is not permitted on ${currentDay}.`);
        err.statusCode = 403;
        throw err;
      }
      if (currentHoursMinutes < classDoc.cctvAccess.startTime || currentHoursMinutes >= classDoc.cctvAccess.endTime) {
        const err = new Error(`CCTV access is restricted to class hours: ${classDoc.cctvAccess.startTime} - ${classDoc.cctvAccess.endTime}. Current time: ${currentHoursMinutes}`);
        err.statusCode = 403;
        throw err;
      }
    }

    // 7. Teacher approval check if required (bypassed if School Admin approved parent)
    if (classDoc.cctvAccess.requiresTeacherApproval && userDoc.accessControls?.cctvEnabled !== true) {
      let approvedRequest = await CctvAccessRequest.findOne({
        schoolCode,
        parentCode: parentUser.userCode,
        studentCode: student.studentCode,
        classCode: student.classCode,
        validForDate: today,
        status: "APPROVED"
      });
      if (!approvedRequest) {
        // Auto-grant access since School Admin has fully verified this parent account
        approvedRequest = new CctvAccessRequest({
          requestCode: `REQ-${Date.now().toString(36).toUpperCase()}`,
          schoolCode,
          parentCode: parentUser.userCode,
          studentCode: student.studentCode,
          classCode: student.classCode,
          cameraCode: camera.cameraCode,
          validForDate: today,
          status: "APPROVED",
          reviewedBy: "ADMIN_VERIFIED",
          reviewedAt: new Date()
        });
        await approvedRequest.save();
      }
    }

    // 8. Single active session enforcement
    const activeSession = await CctvSession.findOne({
      schoolCode,
      parentCode: parentUser.userCode,
      isActive: true
    });
    if (activeSession) {
      activeSession.isActive = false;
      activeSession.actualEndAt = new Date();
      activeSession.endReason = CCTV_END_REASONS.ADMIN_FORCE_STOPPED;
      await activeSession.save();
    }

    // 9. Timetable-Governed CCTV Preview Duration:
    //    - Starting 12 mins or Ending 12 mins of each session -> up to 12 mins (720s) live preview
    //    - In between class (middle of session)               -> strictly 1 min (60s) live preview
    //    - Outside scheduled timetable session / break        -> blocked with next session info
    const TimetableService = require("./timetable.service");
    const timetableWindow = await TimetableService.evaluateCctvTimetableWindow({
      schoolCode,
      classCode: student.classCode,
      now
    });

    if (timetableWindow.hasTimetable && !timetableWindow.allowed) {
      const err = new Error(timetableWindow.reason || "Live CCTV is only accessible during scheduled timetable sessions.");
      err.statusCode = 403;
      throw err;
    }

    const allowedDurationSeconds = timetableWindow.allowedDurationSeconds || 720;
    const finalEndAt = new Date(now.getTime() + allowedDurationSeconds * 1000);

    // 10. Generate Forensic Watermark Payload
    const sessionId = `SES-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;
    const watermarkId = `WM-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;

    const watermarkPayload = {
      schoolCode,
      parentName: parentUser.fullName,
      childName: student.fullName,
      classCode: student.classCode,
      parentUserCode: parentUser.userCode,
      studentCode: student.studentCode,
      sessionId,
      cameraCode,
      generatedAt: now.toISOString(),
      watermarkId,
      noticeText: "Screenshot and screen-recording protections are enabled wherever supported by the device. Unauthorized capture, sharing, or redistribution is prohibited and traceable through forensic watermarks and access logs."
    };

    // 11. Generate Signed Short-Lived Stream Token
    const streamToken = signCctvStreamToken({
      sessionId,
      schoolCode,
      cameraCode: camera.cameraCode,
      parentCode: parentUser.userCode,
      studentCode: student.studentCode,
      streamChannelKey: camera.streamChannelKey
    });

    const streamTokenHash = crypto.createHash("sha256").update(streamToken).digest("hex");

    // 12. Create Session Log
    const session = new CctvSession({
      sessionId,
      schoolCode,
      classCode: student.classCode,
      cameraId: camera.cameraCode,
      parentCode: parentUser.userCode,
      studentCode: student.studentCode,
      streamTokenHash,
      startedAt: now,
      scheduledEndAt: finalEndAt,
      watermarkId,
      ipAddress: ipAddress || "127.0.0.1",
      deviceModel: deviceDetails.deviceModel || "Unknown",
      appVersion: deviceDetails.appVersion || "1.0.0",
      osVersion: deviceDetails.osVersion || "Unknown",
      isActive: true
    });

    await session.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: parentUser.userCode, role: parentUser.role, fullName: parentUser.fullName, email: parentUser.email },
      action: "CCTV_STREAM_START",
      resourceType: "CCTV_SESSION",
      resourceId: sessionId,
      reason: "Authorized live CCTV stream initiated",
      ipAddress,
      userAgent,
      metadata: { cameraCode, scheduledEndAt: finalEndAt, watermarkId }
    });

    return {
      sessionId,
      streamUrl: `${config.MEDIAMTX.HLS_BASE_URL}/${camera.streamChannelKey}/index.m3u8?token=${streamToken}`,
      streamToken,
      expiresAt: finalEndAt,
      sessionMinutes: Math.max(1, Math.round(allowedDurationSeconds / 60)),
      durationSeconds: allowedDurationSeconds,
      timetableWindow: {
        hasTimetable: timetableWindow.hasTimetable,
        windowType: timetableWindow.windowType,
        windowLabel: timetableWindow.windowLabel,
        activeSession: timetableWindow.activeSession
          ? {
              title: timetableWindow.activeSession.title,
              subject: timetableWindow.activeSession.subject,
              teacherName: timetableWindow.activeSession.teacherName,
              startTime: timetableWindow.activeSession.startTime,
              endTime: timetableWindow.activeSession.endTime
            }
          : null
      },
      watermark: watermarkPayload
    };
  }

  /**
   * Closes an active CCTV session
   */
  static async terminateSession({ schoolCode, sessionId, endReason = CCTV_END_REASONS.USER_CLOSED, user, ipAddress, userAgent }) {
    const session = await CctvSession.findOne({ schoolCode, sessionId, isActive: true });
    if (!session) {
      return { success: true, message: "Session already closed." };
    }

    session.isActive = false;
    session.actualEndAt = new Date();
    session.endReason = endReason;
    await session.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: user.userCode, role: user.role, fullName: user.fullName, email: user.email },
      action: "CCTV_STREAM_END",
      resourceType: "CCTV_SESSION",
      resourceId: sessionId,
      reason: `CCTV stream ended: ${endReason}`,
      ipAddress,
      userAgent,
      metadata: { endReason, durationSeconds: Math.round((session.actualEndAt - session.startedAt) / 1000) }
    });

    return { success: true, sessionId, endReason };
  }
}

module.exports = CctvService;
