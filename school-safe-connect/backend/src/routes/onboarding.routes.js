/**
 * Public School Onboarding Routes
 */

const express = require("express");
const SuperAdminController = require("../controllers/superAdmin.controller");

const router = express.Router();

// Public submission endpoint
router.post("/apply", SuperAdminController.submitOnboarding);

module.exports = router;
