/**
 * Socket.IO instance accessor.
 * Holds the server-bound io instance so the notification engine and workers
 * can emit real-time IN_APP events without creating circular module dependencies
 * (app.js <- routes <- controllers <- services).
 */

let io = null;

module.exports = {
  /**
   * Set the Socket.IO server instance (called from server.js after construction).
   */
  setIo(instance) {
    io = instance;
  },

  /**
   * Get the Socket.IO server instance. Returns null if not yet set.
   */
  getIo() {
    return io;
  }
};
