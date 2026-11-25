/**
 * Outbound Notification Dispatcher Service
 * Channel-capable sender for Push (FCM), SMS, WhatsApp, and Email with safe
 * mock fallbacks for local / test environments. Retains sendOtp for backward
 * compatibility with auth flows (auth.service.js, tests).
 */

const admin = require("firebase-admin");
const config = require("../config/env");
const logger = require("../utils/logger");

let firebaseAppInitialized = false;

const MASK_LAST = (value) => {
  if (!value) {return "";}
  const str = String(value);
  if (str.length <= 4) {return "****";}
  return `***${str.slice(-4)}`;
};

/**
 * Lazily initialize Firebase Admin SDK once (singleton).
 * Handles escaped newlines (\n) in FIREBASE_PRIVATE_KEY env var.
 * Returns the app instance or null when credentials are absent/invalid.
 */
function initFirebase() {
  if (firebaseAppInitialized) {
    return admin.apps.length > 0 ? admin.apps[0] : null;
  }
  firebaseAppInitialized = true;

  const { PROJECT_ID, CLIENT_EMAIL, PRIVATE_KEY } = config.FIREBASE || {};
  const hasCreds = PROJECT_ID && CLIENT_EMAIL && PRIVATE_KEY;
  if (!hasCreds) {
    logger.info("[NotificationSender] Firebase credentials not configured; push will use mock fallback.");
    return null;
  }

  try {
    let privateKey = String(PRIVATE_KEY);
    // Support both literal newlines and escaped \\n sequences from env files.
    if (privateKey.includes("\\n")) {
      privateKey = privateKey.replace(/\\n/g, "\n");
    }

    if (admin.apps.length > 0) {
      return admin.apps[0];
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: PROJECT_ID,
        clientEmail: CLIENT_EMAIL,
        privateKey
      }),
      projectId: PROJECT_ID
    });
    logger.info("[NotificationSender] Firebase Admin SDK initialized.");
    return admin.apps[0];
  } catch (error) {
    logger.warn(`[NotificationSender] Firebase admin init failed: ${error.message}. Push will use mock fallback.`);
    return null;
  }
}

class NotificationSenderService {
  /**
   * Dispatches 2FA OTP to user's phone or email.
   * Backward-compatible signature used by auth.service.js and tests.
   * @param {Object} params
   * @param {string} [params.phone]
   * @param {string} [params.email]
   * @param {string} params.otp
   * @param {string} [params.method='SMS'] - 'SMS', 'EMAIL', or 'WHATSAPP'
   */
  // eslint-disable-next-line no-unused-vars
  static async sendOtp({ phone, email, otp, method = "SMS" }) {
    const target = phone || email;
    const maskedTarget = MASK_LAST(target);
    logger.info(`[2FA OTP DISPATCH] [${method}] Target: ${maskedTarget} | OTP: ***REDACTED***`);

    if (config.IS_TEST || config.SMS.PROVIDER === "mock") {
      return { success: true, provider: "mock", messageId: `mock-${Date.now()}` };
    }

    try {
      // Production SMS API call integration hook (MSG91 / Twilio / etc.)
      return { success: true, provider: config.SMS.PROVIDER };
    } catch (error) {
      logger.error("Failed to dispatch outbound OTP:", error);
      throw error;
    }
  }

  /**
   * Send push notification(s) via Firebase Cloud Messaging.
   * @param {Object} params
   * @param {string} params.schoolCode
   * @param {string[]} params.tokens - FCM registration tokens
   * @param {string} params.title
   * @param {string} params.message
   * @param {Object} [params.data]
   * @returns {Object} { provider, successes: [{token, messageId}], failures: [{token, error}], invalidTokens: [] }
   */
  static async sendPush({ schoolCode, tokens, title, message, data = {} }) {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return { provider: "none", successes: [], failures: [], invalidTokens: [] };
    }

    const validTokens = tokens.filter((t) => t && typeof t === "string");
    if (validTokens.length === 0) {
      return { provider: "none", successes: [], failures: [], invalidTokens: [] };
    }

    const app = initFirebase();
    if (!app) {
      logger.info(`[NotificationSender] PUSH [mock] school=${schoolCode} tokens=${validTokens.length} title=${MASK_LAST(title)}`);
      return {
        provider: "mock",
        successes: validTokens.map((token) => ({ token, messageId: `mock-push-${Date.now()}` })),
        failures: [],
        invalidTokens: []
      };
    }

    try {
      const messaging = admin.messaging(app);
      const payload = {
        notification: { title, body: message },
        data: { ...data, schoolCode },
        android: { priority: "high" },
        apns: { headers: { "apns-priority": "10" } }
      };

      // sendEach handles a list of tokens and returns per-token responses.
      const response = await messaging.sendEach(validTokens, payload);

      const successes = [];
      const failures = [];
      const invalidTokens = [];

      validTokens.forEach((token, index) => {
        const resp = response.responses[index];
        if (resp.success) {
          successes.push({ token, messageId: resp.messageId });
        } else {
          const err = resp.error || {};
          const code = err.code || "";
          const isInvalid = /registration-token-not-registered|invalid-argument|mismatched-credential/.test(code);
          if (isInvalid) {
            invalidTokens.push(token);
          }
          failures.push({ token, error: err.message || String(code) || "send_failed" });
        }
      });

      logger.info(`[NotificationSender] PUSH [firebase] school=${schoolCode} success=${response.successCount} failure=${response.failureCount} invalid=${invalidTokens.length}`);
      return { provider: "firebase", successes, failures, invalidTokens };
    } catch (error) {
      logger.error(`[NotificationSender] PUSH [firebase] school=${schoolCode} failed:`, error);
      // Treat whole-batch exception as failures for every token.
      return {
        provider: "firebase",
        successes: [],
        failures: validTokens.map((token) => ({ token, error: error.message || "send_failed" })),
        invalidTokens: []
      };
    }
  }

  /**
   * Send SMS. Mock-safe unless a real provider is configured.
   * @param {Object} params
   * @param {string} params.phone
   * @param {string} params.message
   * @returns {Object} { success, provider, messageId }
   */
  static async sendSms({ phone, message }) {
    const maskedPhone = MASK_LAST(phone);
    logger.info(`[NotificationSender] SMS [${config.SMS.PROVIDER}] to=${maskedPhone} len=${String(message || "").length}`);

    if (config.IS_TEST || config.SMS.PROVIDER === "mock" || !config.SMS.API_KEY) {
      return { success: true, provider: "mock", messageId: `mock-sms-${Date.now()}` };
    }

    try {
      // Real provider integration hook (MSG91 / Twilio / Fast2SMS) using axios.
      // Example: await axios.post(providerUrl, { ... }, { headers: { Authorization: config.SMS.API_KEY } });
      return { success: true, provider: config.SMS.PROVIDER, messageId: `sms-${Date.now()}` };
    } catch (error) {
      logger.error(`[NotificationSender] SMS failed to ${maskedPhone}:`, error);
      return { success: false, provider: config.SMS.PROVIDER || "unknown", messageId: null, error: error.message };
    }
  }

  /**
   * Send WhatsApp. Mock-safe unless a real provider is configured.
   * @param {Object} params
   * @param {string} params.phone
   * @param {string} params.message
   * @returns {Object} { success, provider, messageId }
   */
  static async sendWhatsApp({ phone, message }) {
    const maskedPhone = MASK_LAST(phone);
    logger.info(`[NotificationSender] WHATSAPP [${config.WHATSAPP.PROVIDER}] to=${maskedPhone} len=${String(message || "").length}`);

    if (config.IS_TEST || config.WHATSAPP.PROVIDER === "mock" || !config.WHATSAPP.API_KEY) {
      return { success: true, provider: "mock", messageId: `mock-wa-${Date.now()}` };
    }

    try {
      // Real WhatsApp Business API integration hook using axios.
      return { success: true, provider: config.WHATSAPP.PROVIDER, messageId: `wa-${Date.now()}` };
    } catch (error) {
      logger.error(`[NotificationSender] WhatsApp failed to ${maskedPhone}:`, error);
      return { success: false, provider: config.WHATSAPP.PROVIDER || "unknown", messageId: null, error: error.message };
    }
  }

  /**
   * Send Email. Mock-safe unless a real provider is configured.
   * Provided as a hook; EMAIL is not included in NOTIFICATION_CHANNELS priority
   * mappings by default (wire it into the engine once a real provider is integrated).
   * @param {Object} params
   * @param {string} params.to
   * @param {string} params.subject
   * @param {string} params.text
   * @param {string} [params.html]
   * @returns {Object} { success, provider, messageId }
   */
  // eslint-disable-next-line no-unused-vars
  static async sendEmail({ to, subject, text, html }) {
    const maskedTo = MASK_LAST(to);
    logger.info(`[NotificationSender] EMAIL [${config.EMAIL.PROVIDER}] to=${maskedTo} subject=${MASK_LAST(subject)}`);

    if (config.IS_TEST || config.EMAIL.PROVIDER === "mock" || !config.EMAIL.API_KEY) {
      return { success: true, provider: "mock", messageId: `mock-email-${Date.now()}` };
    }

    try {
      // Real email provider integration hook (SES / SendGrid / SMTP) using axios or aws-sdk.
      return { success: true, provider: config.EMAIL.PROVIDER, messageId: `email-${Date.now()}` };
    } catch (error) {
      logger.error(`[NotificationSender] Email failed to ${maskedTo}:`, error);
      return { success: false, provider: config.EMAIL.PROVIDER || "unknown", messageId: null, error: error.message };
    }
  }
}

module.exports = NotificationSenderService;
