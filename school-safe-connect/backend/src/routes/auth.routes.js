/**
 * Authentication Routes
 */

const express = require("express");
const AuthController = require("../controllers/auth.controller");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

// Public Authentication endpoints
router.post("/login", AuthController.login);
router.post("/verify-2fa", AuthController.verify2FA);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/forgot-password", AuthController.forgotPassword);
router.post("/reset-password", AuthController.resetPassword);
router.post("/register", AuthController.registerUser);
router.get("/registration-status", AuthController.checkRegistrationStatus);

// Protected endpoints
router.post("/logout", authenticate, AuthController.logout);
router.get("/me", authenticate, AuthController.getMe);

module.exports = router;
