/**
 * Authentication Controller
 * Orchestrates login, mandatory 2FA verification, token refresh, and logout.
 */

const AuthService = require("../services/auth.service");
const { User, School } = require("../models");
const { loginSchema, verify2FASchema, refreshTokenSchema } = require("../validators/auth.validator");
const { sendSuccess, sendCreated, sendError } = require("../utils/response");

class AuthController {
  /**
   * POST /api/v1/auth/login
   * Step 1: Validate credentials and trigger 2FA OTP
   */
  static async login(req, res, next) {
    try {
      const { error, value } = loginSchema.validate(req.body, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const clientType = value.clientType || req.headers["x-client-type"];
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await AuthService.loginStep1({
        identifier: value.identifier,
        password: value.password,
        clientType,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Credentials verified. 2FA OTP has been dispatched.", result, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/verify-2fa
   * Step 2: Validate 6-digit OTP and issue JWT access & refresh tokens
   */
  static async verify2FA(req, res, next) {
    try {
      const { error, value } = verify2FASchema.validate(req.body, { abortEarly: false });
      if (error) {
        return sendError(res, "Validation error", 400, error.details.map((d) => d.message));
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await AuthService.verify2FA({
        tempToken: value.tempToken,
        otp: value.otp,
        deviceDetails: value.deviceDetails || {},
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "2FA authentication successful. Logged in.", result, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/refresh-token
   * Refresh expired access token
   */
  static async refreshToken(req, res, next) {
    try {
      const { error, value } = refreshTokenSchema.validate(req.body);
      if (error) {
        return sendError(res, "Refresh token is required", 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await AuthService.refreshTokens({
        refreshToken: value.refreshToken,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Access token refreshed successfully.", result, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/logout
   */
  static async logout(req, res, next) {
    try {
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      await AuthService.logout({
        user: req.user,
        ipAddress,
        userAgent
      });

      return sendSuccess(res, "Successfully logged out.", null, null, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/me
   * Returns current authenticated profile
   */
  static async getMe(req, res, next) {
    try {
      let schoolName = req.user?.schoolName;
      if (!schoolName && req.user?.schoolCode && req.user?.schoolCode !== "GLOBAL") {
        const schoolDoc = await School.findOne({ schoolCode: req.user.schoolCode }).select("name");
        if (schoolDoc && schoolDoc.name) {
          schoolName = schoolDoc.name;
        }
      }
      return sendSuccess(res, "Profile retrieved.", { user: { ...req.user, schoolName: schoolName || req.user?.schoolCode } });
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/forgot-password
   */
  static async forgotPassword(req, res, next) {
    try {
      const { identifier } = req.body;
      if (!identifier) {
        return sendError(res, "Identifier (email/phone/userCode) is required.", 400);
      }
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await AuthService.requestPasswordReset({ identifier, ipAddress, userAgent });
      return sendSuccess(res, result.message, result.data);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/reset-password
   */
  static async resetPassword(req, res, next) {
    try {
      const { resetToken, otp, newPassword } = req.body;
      if (!resetToken || !otp || !newPassword) {
        return sendError(res, "resetToken, otp, and newPassword are required.", 400);
      }
      if (newPassword.length < 8) {
        return sendError(res, "New password must be at least 8 characters long.", 400);
      }
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const result = await AuthService.completePasswordReset({ resetToken, otp, newPassword, ipAddress, userAgent });
      return sendSuccess(res, result.message);
    } catch (err) {
      next(err);
    }
  }

  /**
   * POST /api/v1/auth/register
   * Public onboarding registration for Parents, Teachers, Drivers
   * Registers account in PENDING status until verified by School Admin
   */
  static async registerUser(req, res, next) {
    try {
      const {
        schoolCode,
        role,
        fullName,
        email,
        phone,
        password,
        // Parent-specific fields
        studentAdmissionNumber,
        childFullName,
        childGrade,
        childSection,
        relationship,
        consentAccepted
      } = req.body;

      if (!schoolCode || !role || !fullName || !email || !phone || !password) {
        return sendError(res, "Missing required registration parameters.", 400);
      }

      if (password.length < 8) {
        return sendError(res, "Password must be at least 8 characters long.", 400);
      }

      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers["user-agent"] || "unknown";

      const newUser = await AuthService.registerInternalUser({
        schoolCode: schoolCode.toUpperCase().trim(),
        role: role.toUpperCase().trim(),
        fullName: fullName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password,
        studentAdmissionNumber,
        childFullName,
        childGrade,
        childSection,
        relationship,
        consentAccepted: Boolean(consentAccepted),
        ipAddress,
        userAgent
      });

      return sendCreated(
        res,
        "Registration application submitted successfully! Your account is in PENDING status awaiting verification and approval by the School Admin.",
        newUser
      );
    } catch (err) {
      next(err);
    }
  }

  /**
   * GET /api/v1/auth/registration-status?identifier=...
   * Allows applicants to check whether School Admin has verified and approved their request,
   * and view their newly generated serial identity code once approved.
   */
  static async checkRegistrationStatus(req, res, next) {
    try {
      const { identifier } = req.query;
      if (!identifier || !identifier.trim()) {
        return sendError(res, "Email or phone identifier is required", 400);
      }
      const trimmed = identifier.trim().toLowerCase();
      const user = await User.findOne({
        $or: [
          { email: trimmed },
          { phone: identifier.trim() },
          { userCode: identifier.trim().toUpperCase() }
        ]
      });

      if (!user) {
        return sendError(res, "No application found for this identifier.", 404);
      }

      return sendSuccess(res, "Application status retrieved", {
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        schoolCode: user.schoolCode,
        status: user.status,
        userCode: user.userCode || null,
        verificationStatus: user.verificationDetails?.status || "PENDING",
        verificationNotes: user.verificationDetails?.verificationNotes || null,
        submittedAt: user.createdAt
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AuthController;
