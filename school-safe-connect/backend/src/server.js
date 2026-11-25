/**
 * HTTP & WebSocket Server Entrypoint
 * Bootstraps MongoDB, Socket.IO, Super Admin initial account, and manages graceful shutdowns.
 */

const http = require("http");
const { Server } = require("socket.io");
const app = require("./app");
const config = require("./config/env");
const { connectDB, disconnectDB } = require("./config/database");
const { SuperAdmin, Counter } = require("./models");
const { hashPassword } = require("./utils/password");
const ioUtil = require("./utils/io");
const logger = require("./utils/logger");

const server = http.createServer(app);

// Socket.IO for real-time panic alerts, transport telemetry, and IN_APP notifications
const io = new Server(server, {
  cors: {
    origin: config.CORS_ORIGIN,
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Attach socket server to app context for controllers
app.set("io", io);
// Expose io to notification engine / workers without circular deps
ioUtil.setIo(io);

io.on("connection", (socket) => {
  logger.info(`Socket client connected: ${socket.id}`);

  socket.on("join_tenant", ({ schoolCode }) => {
    if (schoolCode) {
      socket.join(`tenant_${schoolCode}`);
      logger.info(`Socket ${socket.id} joined tenant room: tenant_${schoolCode}`);
    }
  });

  socket.on("join_user", ({ schoolCode, userCode }) => {
    if (schoolCode && userCode) {
      socket.join(`tenant_${schoolCode}_user_${userCode}`);
      logger.info(`Socket ${socket.id} joined user room: tenant_${schoolCode}_user_${userCode}`);
    }
  });

  socket.on("disconnect", () => {
    logger.info(`Socket client disconnected: ${socket.id}`);
  });
});

const NotificationWorker = require("./workers/notification.worker");

/**
 * Bootstraps the initial Global Super Admin if absent
 */
const bootstrapSuperAdmin = async () => {
  try {
    const existing = await SuperAdmin.findOne({ userCode: config.SUPER_ADMIN.CODE });
    if (!existing) {
      const passwordHash = await hashPassword(config.SUPER_ADMIN.PASSWORD);
      const admin = new SuperAdmin({
        userCode: config.SUPER_ADMIN.CODE,
        fullName: config.SUPER_ADMIN.NAME,
        email: config.SUPER_ADMIN.EMAIL,
        phone: config.SUPER_ADMIN.PHONE,
        passwordHash,
        status: "ACTIVE",
        twoFactor: {
          method: "AUTHENTICATOR",
          isVerified: true
        }
      });
      await admin.save();

      // Initialize global sequence counters
      await Counter.findOneAndUpdate(
        { sequenceName: "SCHOOL_CODE", schoolCode: "GLOBAL" },
        { $setOnInsert: { sequenceValue: 1000 } },
        { upsert: true }
      );

      logger.info(`Bootstrap: Global Super Admin created successfully [${config.SUPER_ADMIN.CODE}]`);
    }
  } catch (error) {
    logger.error("Failed to bootstrap Global Super Admin:", error);
  }
};

/**
 * Server Startup
 */
const startServer = async () => {
  try {
    await connectDB();
    await bootstrapSuperAdmin();

    server.listen(config.PORT, () => {
      logger.info("========================================================");
      logger.info("School Safe Connect API server active");
      logger.info(`Environment: ${config.NODE_ENV}`);
      logger.info(`Port: ${config.PORT}`);
      logger.info(`API Base URL: http://localhost:${config.PORT}${config.API_PREFIX}`);
      logger.info(`Health check: http://localhost:${config.PORT}/health`);
      logger.info("========================================================");

      // Start notification queue worker (guarded; off in test env by default)
      if (config.NOTIFICATION.WORKER_ENABLED && config.NODE_ENV !== "test") {
        NotificationWorker.start().catch((err) => {
          logger.error("[NotificationWorker] Failed to start:", err);
        });
      }
    });
  } catch (error) {
    logger.error("Fatal failure starting server:", error);
    process.exit(1);
  }
};

// Graceful Termination Handlers
const handleShutdown = async (signal) => {
  logger.info(`${signal} received. Initiating graceful shutdown sequence...`);

  try {
    await NotificationWorker.stop();
  } catch (error) {
    logger.warn("[NotificationWorker] stop during shutdown:", error.message);
  }

  server.close(async () => {
    logger.info("HTTP and WebSocket server closed.");
    await disconnectDB();
    logger.info("Graceful shutdown completed successfully. Exiting process.");
    process.exit(0);
  });

  // Force close after 10 seconds if hanging
  setTimeout(() => {
    logger.error("Could not cleanly terminate connections in time. Forcing exit.");
    process.exit(1);
  }, 10000);
};

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

if (require.main === module) {
  startServer();
}

module.exports = { app, server, startServer };
