/**
 * Express Application Configuration
 * Integrates enterprise security middlewares: Helmet, CORS, Rate Limiting, Mongo Sanitization,
 * Request Logging, and Centralized Modular Routing.
 */

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("express-mongo-sanitize");
const morgan = require("morgan");

const config = require("./config/env");
const logger = require("./utils/logger");
const errorHandler = require("./middlewares/errorHandler");
const { sendError } = require("./utils/response");

// Route modules
const authRoutes = require("./routes/auth.routes");
const onboardingRoutes = require("./routes/onboarding.routes");
const superAdminRoutes = require("./routes/superAdmin.routes");
const schoolAdminRoutes = require("./routes/schoolAdmin.routes");
const classRoutes = require("./routes/class.routes");
const studentRoutes = require("./routes/student.routes");
const assignmentRoutes = require("./routes/assignment.routes");
const noticeRoutes = require("./routes/notice.routes");
const incidentRoutes = require("./routes/incident.routes");
const panicRoutes = require("./routes/panic.routes");
const transportRoutes = require("./routes/transport.routes");
const cctvRoutes = require("./routes/cctv.routes");
const notificationRoutes = require("./routes/notification.routes");
const aiRoutes = require("./routes/ai.routes");
const timetableRoutes = require("./routes/timetable.routes");
const feeRoutes = require("./routes/fee.routes");
const eventRoutes = require("./routes/event.routes");
const assessmentRoutes = require("./routes/assessment.routes");

const app = express();

// Trust proxy for secure cookies / rate-limiting behind load balancers
app.set("trust proxy", 1);

// Security Headers with Helmet
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// Cross-Origin Resource Sharing
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) {return callback(null, true);}
      if (config.CORS_ORIGIN.indexOf(origin) !== -1 || !config.IS_PRODUCTION) {
        return callback(null, true);
      }
      return callback(new Error("CORS access rejected by security policy"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "X-School-Code", "X-Super-Admin-Reason", "X-Client-Type"]
  })
);

// Body Parsers
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ extended: true, limit: "15mb" }));

// Static Uploads (Assignment files)
const path = require("path");
app.use("/uploads", express.static(path.resolve(__dirname, "../uploads")));

// NoSQL Injection Sanitization
app.use(mongoSanitize());

// HTTP Request Logging
const morganStream = {
  write: (message) => logger.http(message.trim())
};
app.use(morgan(":method :url :status :res[content-length] - :response-time ms", { stream: morganStream }));

// Global Rate Limiter
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: "Too many requests from this IP address. Please try again after 15 minutes.",
    timestamp: new Date().toISOString()
  }
});
app.use(globalLimiter);

// Health Check Endpoint
app.get("/health", (req, res) => {
  res.status(200).json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: config.NODE_ENV
  });
});

// API Routes Mount
app.use(`${config.API_PREFIX}/auth`, authRoutes);
app.use(`${config.API_PREFIX}/onboarding`, onboardingRoutes);
app.use(`${config.API_PREFIX}/super-admin`, superAdminRoutes);
app.use(`${config.API_PREFIX}/school-admin`, schoolAdminRoutes);
app.use(`${config.API_PREFIX}/classes`, classRoutes);
app.use(`${config.API_PREFIX}/students`, studentRoutes);
app.use(`${config.API_PREFIX}/assignments`, assignmentRoutes);
app.use(`${config.API_PREFIX}/notices`, noticeRoutes);
app.use(`${config.API_PREFIX}/incidents`, incidentRoutes);
app.use(`${config.API_PREFIX}/panic`, panicRoutes);
app.use(`${config.API_PREFIX}/transport`, transportRoutes);
// CCTV Module has been entirely removed from the platform
app.use(`${config.API_PREFIX}/cctv`, (req, res) => {
  return res.status(200).json({ success: true, message: "CCTV module has been removed from this system.", data: { cameras: [], requests: [] } });
});
app.use(`${config.API_PREFIX}/notifications`, notificationRoutes);
app.use(`${config.API_PREFIX}/ai`, aiRoutes);
app.use(`${config.API_PREFIX}/timetable`, timetableRoutes);
app.use(`${config.API_PREFIX}/fees`, feeRoutes);
app.use(`${config.API_PREFIX}/events`, eventRoutes);
app.use(`${config.API_PREFIX}/assessments`, assessmentRoutes);

// Catch-all 404 Route Handler
app.use((req, res) => {
  return sendError(res, `Endpoint not found: ${req.method} ${req.originalUrl}`, 404);
});

// Centralized Error Middleware
app.use(errorHandler);

module.exports = app;
