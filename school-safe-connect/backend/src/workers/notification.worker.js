/**
 * Notification Worker
 * Bootstraps the Redis-backed notification queue consumer loop. Started from server.js
 * after DB connect / app ready. Guarded by NOTIFICATION_WORKER_ENABLED and NODE_ENV so
 * tests and single-process dev can opt out.
 */

const NotificationQueueService = require("../services/notificationQueue.service");
const logger = require("../utils/logger");

const worker = {
  started: false,

  async start() {
    if (this.started) {return;}
    await NotificationQueueService.start();
    this.started = true;
  },

  async stop() {
    if (!this.started) {return;}
    NotificationQueueService.stop();
    await NotificationQueueService.disconnect();
    this.started = false;
  },

  // Expose one-off processing for tests / on-demand draining.
  async processPending() {
    return NotificationQueueService.processPending();
  }
};

module.exports = worker;

// Allow running standalone: node src/workers/notification.worker.js
if (require.main === module) {
  (async () => {
    logger.info("[NotificationWorker] Starting standalone worker...");
    await worker.start();
  })().catch((err) => {
    logger.error("[NotificationWorker] Fatal worker error:", err);
    process.exit(1);
  });
}
