/**
 * AI / Free LLM Routes
 */

const express = require("express");
const AiController = require("../controllers/ai.controller");
const { authenticate } = require("../middlewares/authMiddleware");

const router = express.Router();

// Health / Token Consumption status (publicly checkable or authenticated)
router.get("/status", AiController.status);

// Authenticated AI assistant chat
router.post("/chat", authenticate, AiController.chat);

module.exports = router;
