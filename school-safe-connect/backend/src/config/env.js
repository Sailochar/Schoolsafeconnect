/**
 * Application Environment Configuration
 * Validates and exposes strictly typed environment settings.
 */

const dotenv = require("dotenv");
const path = require("path");

// Load .env file
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const NODE_ENV = process.env.NODE_ENV || "development";

// Validate production secrets
if (NODE_ENV === "production") {
  const mandatorySecrets = [
    "MONGODB_URI",
    "JWT_ACCESS_SECRET",
    "JWT_REFRESH_SECRET",
    "JWT_2FA_TEMP_SECRET",
    "CCTV_STREAM_TOKEN_SECRET"
  ];

  const missing = mandatorySecrets.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`CRITICAL SECURITY FAILURE: Missing mandatory production environment variables: ${missing.join(", ")}`);
  }
}

module.exports = {
  NODE_ENV,
  IS_PRODUCTION: NODE_ENV === "production",
  IS_TEST: NODE_ENV === "test",
  PORT: parseInt(process.env.PORT || "5000", 10),
  API_PREFIX: process.env.API_PREFIX || "/api/v1",
  CORS_ORIGIN: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",") : ["http://localhost:3000"],

  MONGODB: {
    URI: process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/school_safe_connect",
    DB_NAME: process.env.MONGODB_DB_NAME || "school_safe_connect",
    MAX_POOL_SIZE: parseInt(process.env.MONGODB_MAX_POOL_SIZE || "50", 10)
  },

  REDIS: {
    URL: process.env.REDIS_URL || "redis://127.0.0.1:6379"
  },

  JWT: {
    ACCESS_SECRET: process.env.JWT_ACCESS_SECRET || "dev_jwt_access_secret_key_minimum_64_characters_long_for_security_testing_purpose",
    ACCESS_EXPIRY: process.env.JWT_ACCESS_EXPIRY || "15m",
    REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || "dev_jwt_refresh_secret_key_minimum_64_characters_long_for_security_testing_purpose",
    REFRESH_EXPIRY: process.env.JWT_REFRESH_EXPIRY || "7d",
    TEMP_2FA_SECRET: process.env.JWT_2FA_TEMP_SECRET || "dev_jwt_2fa_temp_secret_key_minimum_64_characters_long_for_security_testing",
    TEMP_2FA_EXPIRY: process.env.JWT_2FA_TEMP_EXPIRY || "5m",
    CCTV_SECRET: process.env.CCTV_STREAM_TOKEN_SECRET || "dev_cctv_stream_token_secret_key_minimum_64_characters_long_security",
    CCTV_EXPIRY: process.env.CCTV_STREAM_TOKEN_EXPIRY || "10m"
  },

  OTP: {
    EXPIRY_SECONDS: parseInt(process.env.OTP_EXPIRY_SECONDS || "300", 10), // 5 minutes
    MAX_ATTEMPTS: parseInt(process.env.OTP_MAX_ATTEMPTS || "5", 10),
    COOLDOWN_SECONDS: parseInt(process.env.OTP_COOLDOWN_SECONDS || "600", 10) // 10 minutes
  },

  SUPER_ADMIN: {
    CODE: process.env.SUPER_ADMIN_CODE || "SSC-GSA-001",
    NAME: process.env.SUPER_ADMIN_NAME || "Global Security Director",
    EMAIL: process.env.SUPER_ADMIN_EMAIL || "superadmin@schoolsafeconnect.internal",
    PHONE: process.env.SUPER_ADMIN_PHONE || "+919876543210",
    PASSWORD: process.env.SUPER_ADMIN_PASSWORD || "SuperAdmin@Secure2026!"
  },

  TRANSPORT: {
    MIN_DELAY_SECONDS: parseInt(process.env.TRANSPORT_VISIBILITY_MIN_DELAY_SECONDS || "10", 10),
    MAX_DELAY_SECONDS: parseInt(process.env.TRANSPORT_VISIBILITY_MAX_DELAY_SECONDS || "60", 10),
    DEFAULT_DELAY_SECONDS: parseInt(process.env.TRANSPORT_VISIBILITY_DEFAULT_DELAY_SECONDS || "30", 10)
  },

  MEDIAMTX: {
    API_URL: process.env.MEDIAMTX_API_URL || "http://localhost:8554",
    HLS_BASE_URL: process.env.MEDIAMTX_HLS_BASE_URL || "http://localhost:8888",
    SECRET_KEY: process.env.MEDIAMTX_SECRET_KEY || "media_stream_internal_secret_key_849204"
  },

  SMS: {
    PROVIDER: process.env.SMS_PROVIDER || "mock",
    API_KEY: process.env.SMS_API_KEY || "",
    SENDER_ID: process.env.SMS_SENDER_ID || "SSCSAFE"
  },

  WHATSAPP: {
    PROVIDER: process.env.WHATSAPP_PROVIDER || "mock",
    API_KEY: process.env.WHATSAPP_API_KEY || "",
    PHONE_NUMBER_ID: process.env.WHATSAPP_PHONE_NUMBER_ID || "",
    BUSINESS_ACCOUNT_ID: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || ""
  },

  EMAIL: {
    PROVIDER: process.env.EMAIL_PROVIDER || "mock",
    API_KEY: process.env.EMAIL_API_KEY || "",
    FROM_EMAIL: process.env.EMAIL_FROM_EMAIL || "noreply@schoolsafeconnect.internal",
    FROM_NAME: process.env.EMAIL_FROM_NAME || "School Safe Connect"
  },

  FIREBASE: {
    PROJECT_ID: process.env.FIREBASE_PROJECT_ID || "",
    CLIENT_EMAIL: process.env.FIREBASE_CLIENT_EMAIL || "",
    PRIVATE_KEY: process.env.FIREBASE_PRIVATE_KEY || ""
  },

  NOTIFICATION: {
    MAX_RETRIES: parseInt(process.env.NOTIFICATION_MAX_RETRIES || "3", 10),
    RETRY_BASE_DELAY_MS: parseInt(process.env.NOTIFICATION_RETRY_BASE_DELAY_MS || "1000", 10),
    RETRY_MAX_DELAY_MS: parseInt(process.env.NOTIFICATION_RETRY_MAX_DELAY_MS || "60000", 10),
    WORKER_ENABLED: process.env.NOTIFICATION_WORKER_ENABLED !== "false",
    BATCH_SIZE: parseInt(process.env.NOTIFICATION_BATCH_SIZE || "20", 10)
  },

  STORAGE: {
    PROVIDER: process.env.STORAGE_PROVIDER || "mock",
    ENDPOINT: process.env.S3_ENDPOINT || "",
    REGION: process.env.S3_REGION || "auto",
    BUCKET: process.env.S3_BUCKET_NAME || "school-safe-connect-media",
    ACCESS_KEY: process.env.S3_ACCESS_KEY_ID || "",
    SECRET_KEY: process.env.S3_SECRET_ACCESS_KEY || ""
  },

  LOG_LEVEL: process.env.LOG_LEVEL || "info"
};
