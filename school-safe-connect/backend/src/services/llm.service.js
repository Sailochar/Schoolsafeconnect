/**
 * Free LLM API Integration Service
 * Connects to zero-cost / free LLM APIs (Pollinations OpenAI-compatible Free API by default,
 * plus optional OpenRouter Free, Groq Free Tier, or Gemini Free Tier via .env)
 * and tracks prompt/completion token consumption.
 */

const config = require("../config/env");
const logger = require("../utils/logger");

const usageStats = {
  totalRequests: 0,
  totalPromptTokens: 0,
  totalCompletionTokens: 0,
  totalTokens: 0,
  lastProvider: null,
  lastModel: null,
  lastConnectedAt: null
};

class LlmService {
  static getConfig() {
    const provider = (process.env.LLM_PROVIDER || "freellmapi").toLowerCase();
    const apiKey = process.env.LLM_API_KEY || "freellmapi-f5932179a365b4023764cda7c9a17769f494ddf362b8ef4c";

    if (provider === "freellmapi") {
      return {
        provider: "freellmapi",
        baseUrl: process.env.LLM_BASE_URL || "http://127.0.0.1:31415/v1/chat/completions",
        model: process.env.LLM_MODEL || "nemotron-3.5-lightning-30b-a3b",
        apiKey
      };
    }

    if (provider === "openrouter" && apiKey) {
      return {
        provider: "openrouter",
        baseUrl: process.env.LLM_BASE_URL || "https://openrouter.ai/api/v1/chat/completions",
        model: process.env.LLM_MODEL || "meta-llama/llama-3.2-3b-instruct:free",
        apiKey
      };
    }

    if (provider === "groq" && apiKey) {
      return {
        provider: "groq",
        baseUrl: process.env.LLM_BASE_URL || "https://api.groq.com/openai/v1/chat/completions",
        model: process.env.LLM_MODEL || "llama-3.1-8b-instant",
        apiKey
      };
    }

    if (provider === "custom" && process.env.LLM_BASE_URL) {
      return {
        provider: "custom",
        baseUrl: process.env.LLM_BASE_URL,
        model: process.env.LLM_MODEL || "openai",
        apiKey
      };
    }

    // Default: Zero-key Free LLM API (Pollinations OpenAI-compatible endpoint)
    return {
      provider: "pollinations-free",
      baseUrl: process.env.LLM_BASE_URL || "https://text.pollinations.ai/openai",
      model: process.env.LLM_MODEL || "openai",
      apiKey: ""
    };
  }

  static cleanReply(reply = "") {
    if (!reply) return "";
    let cleaned = String(reply).trim();
    // Strip <think>...</think> blocks
    cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();

    // Check for explicit response transition markers
    const draftMatch = cleaned.match(/(?:Let's draft[:\s]+|Here is (?:the|a) (?:response|draft)[:\s]+|Response[:\s]+|Final (?:Answer|Response)[:\s]+)([\s\S]+)$/i);
    if (draftMatch && draftMatch[1] && draftMatch[1].trim().length > 20) {
      cleaned = draftMatch[1].trim();
    } else if (/^Here's a thinking process:/i.test(cleaned)) {
      const parts = cleaned.split(/\n\s*\n/);
      const nonThinking = parts.filter(
        (p) => !/^(Here's a thinking process|\d+\.\s+\*\*(?:Analyze|Identify|Determine|Draft|Structure|Check|Refine))/i.test(p.trim())
      );
      if (nonThinking.length > 0) {
        cleaned = nonThinking.join("\n\n").replace(/^["']|["']$/g, "").trim();
      }
    }
    return cleaned || reply;
  }

  static estimateTokens(text = "") {
    if (!text) return 0;
    return Math.max(1, Math.ceil(String(text).trim().length / 4));
  }

  static getStatus() {
    const cfg = this.getConfig();
    return {
      connected: true,
      provider: cfg.provider,
      model: cfg.model,
      endpoint: cfg.baseUrl,
      requiresApiKey: cfg.provider !== "pollinations-free",
      usage: { ...usageStats }
    };
  }

  static async chat({ prompt, messages = [], systemPrompt, context = {} }) {
    const cfg = this.getConfig();
    const defaultSystem =
      systemPrompt ||
      `You are the School Safe Connect (SSC) AI Safety & Transit Assistant for School Tenant [${context.schoolCode || "GLOBAL"}]. ` +
      `Help school administrators, teachers, parents, and bus drivers concisely with bus routing, GPS safety alerts, CCTV access policies, student incident summaries, and school communications.`;

    const finalMessages = [
      { role: "system", content: defaultSystem },
      ...messages.filter((m) => m && m.role && m.content),
      ...(prompt ? [{ role: "user", content: prompt }] : [])
    ];

    const headers = {
      "Content-Type": "application/json"
    };
    if (cfg.apiKey) {
      headers.Authorization = `Bearer ${cfg.apiKey}`;
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch(cfg.baseUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: cfg.model,
          messages: finalMessages,
          temperature: 0.5,
          max_tokens: 650
        }),
        signal: controller.signal
      });
      clearTimeout(timeout);

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Free LLM API HTTP ${response.status}: ${errText.slice(0, 160)}`);
      }

      const rawText = await response.text();
      let reply = "";
      let promptTokens = 0;
      let completionTokens = 0;

      try {
        const parsed = JSON.parse(rawText);
        reply =
          parsed?.choices?.[0]?.message?.content ||
          parsed?.choices?.[0]?.text ||
          parsed?.response ||
          rawText;
        promptTokens = parsed?.usage?.prompt_tokens || this.estimateTokens(JSON.stringify(finalMessages));
        completionTokens = parsed?.usage?.completion_tokens || this.estimateTokens(reply);
      } catch {
        reply = rawText;
        promptTokens = this.estimateTokens(JSON.stringify(finalMessages));
        completionTokens = this.estimateTokens(reply);
      }

      const totalTokens = promptTokens + completionTokens;
      usageStats.totalRequests += 1;
      usageStats.totalPromptTokens += promptTokens;
      usageStats.totalCompletionTokens += completionTokens;
      usageStats.totalTokens += totalTokens;
      usageStats.lastProvider = cfg.provider;
      usageStats.lastModel = cfg.model;
      usageStats.lastConnectedAt = new Date().toISOString();

      return {
        reply: this.cleanReply(reply),
        provider: cfg.provider,
        model: cfg.model,
        liveApi: true,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens,
          sessionTotalTokens: usageStats.totalTokens
        }
      };
    } catch (err) {
      clearTimeout(timeout);
      logger.warn(`[LlmService] Free LLM primary call failed (${err.message}). Trying Pollinations GET fallback.`);

      // Secondary Free LLM fallback endpoint
      try {
        const simplePrompt = encodeURIComponent(`${defaultSystem}\n\nUser: ${prompt || messages[messages.length - 1]?.content || "Hello"}`);
        const fallbackRes = await fetch(`https://text.pollinations.ai/${simplePrompt}`, { method: "GET" });
        if (fallbackRes.ok) {
          const replyText = (await fallbackRes.text()).trim();
          const promptTokens = this.estimateTokens(prompt || defaultSystem);
          const completionTokens = this.estimateTokens(replyText);
          const totalTokens = promptTokens + completionTokens;

          usageStats.totalRequests += 1;
          usageStats.totalPromptTokens += promptTokens;
          usageStats.totalCompletionTokens += completionTokens;
          usageStats.totalTokens += totalTokens;
          usageStats.lastProvider = "pollinations-free-get";
          usageStats.lastModel = "openai";
          usageStats.lastConnectedAt = new Date().toISOString();

          return {
            reply: replyText,
            provider: "pollinations-free-get",
            model: "openai",
            liveApi: true,
            usage: {
              promptTokens,
              completionTokens,
              totalTokens,
              sessionTotalTokens: usageStats.totalTokens
            }
          };
        }
      } catch (fallbackErr) {
        logger.warn(`[LlmService] Fallback Free LLM unreachable: ${fallbackErr.message}`);
      }

      // Deterministic local safety fallback if offline
      const offlineReply =
        `[SSC Offline AI Assistant] Free LLM endpoint is temporarily unreachable (${err.message}). ` +
        `School Safe Connect systems are operational for tenant ${context.schoolCode || "GLOBAL"}: ` +
        `Live GPS Fleet Tracking, Route Stops, Parent CCTV Watermarking, and SOS Alerts remain active.`;
      const promptTokens = this.estimateTokens(prompt || "");
      const completionTokens = this.estimateTokens(offlineReply);
      usageStats.totalRequests += 1;
      usageStats.totalPromptTokens += promptTokens;
      usageStats.totalCompletionTokens += completionTokens;
      usageStats.totalTokens += promptTokens + completionTokens;

      return {
        reply: offlineReply,
        provider: "local-fallback",
        model: "ssc-safety-rules",
        liveApi: false,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
          sessionTotalTokens: usageStats.totalTokens
        }
      };
    }
  }
}

module.exports = LlmService;
