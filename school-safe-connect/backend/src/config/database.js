/**
 * MongoDB Atlas / Standalone Database Connection
 * Enforces production-grade connection pooling, auto-reconnection, and indexing.
 */

const mongoose = require("mongoose");
const config = require("./env");
const logger = require("../utils/logger");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    logger.info("Using existing MongoDB database connection");
    return mongoose.connection;
  }

  const options = {
    maxPoolSize: config.MONGODB.MAX_POOL_SIZE,
    minPoolSize: 5,
    serverSelectionTimeoutMS: 10000,
    socketTimeoutMS: 45000,
    autoIndex: !config.IS_PRODUCTION // Build indexes automatically in non-prod
  };

  try {
    const conn = await mongoose.connect(config.MONGODB.URI, options);
    isConnected = true;
    logger.info(`MongoDB Connected successfully to: ${conn.connection.host} [DB: ${conn.connection.name}]`);

    mongoose.connection.on("error", (err) => {
      logger.error("MongoDB runtime connection error:", err);
    });

    mongoose.connection.on("disconnected", () => {
      isConnected = false;
      logger.warn("MongoDB connection lost. Reconnecting...");
    });

    mongoose.connection.on("reconnected", () => {
      isConnected = true;
      logger.info("MongoDB reconnected successfully.");
    });

    return conn;
  } catch (error) {
    logger.error("Fatal error connecting to MongoDB:", error);
    if (config.IS_PRODUCTION) {
      process.exit(1);
    }
    throw error;
  }
};

const disconnectDB = async () => {
  if (isConnected) {
    await mongoose.connection.close();
    isConnected = false;
    logger.info("MongoDB connection cleanly closed.");
  }
};

module.exports = {
  connectDB,
  disconnectDB,
  mongoose
};
