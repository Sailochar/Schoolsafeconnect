/**
 * AI / Free LLM Controller
 */

const LlmService = require("../services/llm.service");
const { sendSuccess, sendError } = require("../utils/response");

class AiController {
  static async status(req, res, next) {
    try {
      const info = LlmService.getStatus();
      return sendSuccess(res, "Free LLM API connection status retrieved.", info);
    } catch (err) {
      next(err);
    }
  }

  static async chat(req, res, next) {
    try {
      const { prompt, messages, systemPrompt } = req.body || {};
      if (!prompt && (!Array.isArray(messages) || messages.length === 0)) {
        return sendError(res, "A 'prompt' or non-empty 'messages' array is required.", 400);
      }

      const result = await LlmService.chat({
        prompt,
        messages,
        systemPrompt,
        context: {
          schoolCode: req.user?.schoolCode || "GLOBAL",
          userCode: req.user?.userCode,
          role: req.user?.role
        }
      });

      return sendSuccess(res, "Free LLM response generated.", result);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = AiController;
