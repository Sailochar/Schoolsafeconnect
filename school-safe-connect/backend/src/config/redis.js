/**
 * Redis Connection for Token Blacklisting, OTP Storage, and Rate Limiting
 */

const Redis = require("ioredis");
const config = require("./env");
const logger = require("../utils/logger");

let redisClient = null;

try {
  redisClient = new Redis(config.REDIS.URL, {
    maxRetriesPerRequest: 3,
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      return delay;
    },
    lazyConnect: true
  });

  redisClient.on("connect", () => {
    logger.info("Redis connection established successfully.");
  });

  redisClient.on("error", (err) => {
    logger.warn(`Redis connection warning: ${err.message}. Running with memory fallback if offline.`);
  });
} catch (error) {
  logger.warn("Redis initialization error. Using in-memory store for dev.", error);
}

// In-memory fallback map if Redis is unavailable in local development
const memoryStore = new Map();

const redisWrapper = {
  client: redisClient,

  async set(key, value, mode, duration) {
    try {
      if (redisClient && redisClient.status === "ready") {
        if (mode === "EX" && duration) {
          return await redisClient.set(key, value, "EX", duration);
        }
        return await redisClient.set(key, value);
      }
    } catch {
      // Fall through to memoryStore
    }
    memoryStore.set(key, value);
    if (mode === "EX" && duration) {
      setTimeout(() => memoryStore.delete(key), duration * 1000);
    }
    return "OK";
  },

  async get(key) {
    try {
      if (redisClient && redisClient.status === "ready") {
        return await redisClient.get(key);
      }
    } catch {
      // Fall through to memoryStore
    }
    return memoryStore.get(key) || null;
  },

  async del(key) {
    try {
      if (redisClient && redisClient.status === "ready") {
        return await redisClient.del(key);
      }
    } catch {
      // Fall through to memoryStore
    }
    return memoryStore.delete(key) ? 1 : 0;
  },

  /**
   * Atomic increment with optional TTL (Redis INCR with memory fallback).
   * Used for panic-alert rate-limit counters per tenant/user.
   */
  async incr(key, ttlSeconds) {
    try {
      if (redisClient && redisClient.status === "ready") {
        const current = await redisClient.incr(key);
        if (ttlSeconds) {
          const ttl = await redisClient.ttl(key);
          if (ttl === -1) {
            await redisClient.expire(key, ttlSeconds);
          }
        }
        return current;
      }
    } catch {
      // Fall through to memoryStore
    }
    const previous = memoryStore.get(key);
    const next = (previous ? parseInt(previous, 10) : 0) + 1;
    memoryStore.set(key, String(next));
    if (ttlSeconds) {
      setTimeout(() => memoryStore.delete(key), ttlSeconds * 1000);
    }
    return next;
  }
};

module.exports = redisWrapper;
