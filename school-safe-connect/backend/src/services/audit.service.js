/**
 * Audit Logging Service
 * Records immutable, append-only entries into the audit log ledger.
 */

const { v4: uuidv4 } = require("uuid");
const { AuditLog } = require("../models");
const logger = require("../utils/logger");

class AuditService {
  /**
   * Appends an immutable audit log record.
   * @param {Object} params
   * @param {string} params.schoolCode - Tenant schoolCode or 'GLOBAL'
   * @param {Object} params.actor - { userCode, role, fullName, email }
   * @param {string} params.action - Event action string (e.g. SCHOOL_APPROVED, LOGIN_SUCCESS)
   * @param {string} params.resourceType - Type of resource affected (e.g. 'SCHOOL', 'USER', 'CCTV')
   * @param {string} [params.resourceId] - Specific ID of the resource
   * @param {string} [params.reason] - Mandatory justification for sensitive/superadmin operations
   * @param {string} params.ipAddress - Client IP
   * @param {string} [params.userAgent] - Client User Agent
   * @param {Object} [params.metadata] - Additional contextual telemetry
   */
  static async log({
    schoolCode = "GLOBAL",
    actor,
    action,
    resourceType,
    resourceId = null,
    reason = null,
    ipAddress,
    userAgent = "unknown",
    metadata = {}
  }) {
    try {
      const logEntry = new AuditLog({
        logId: `AUD-${Date.now()}-${uuidv4().substring(0, 8)}`,
        schoolCode,
        actor: {
          userCode: actor?.userCode || "SYSTEM",
          role: actor?.role || "SYSTEM",
          fullName: actor?.fullName || "System Automated Process",
          email: actor?.email || "system@schoolsafeconnect.internal"
        },
        action,
        resourceType,
        resourceId: resourceId ? String(resourceId) : undefined,
        reason,
        ipAddress: ipAddress || "127.0.0.1",
        userAgent,
        metadata
      });

      await logEntry.save();
      logger.info(`[AUDIT] Action: ${action} | Actor: ${actor?.userCode || "SYSTEM"} | School: ${schoolCode}`);
      return logEntry;
    } catch (error) {
      logger.error("CRITICAL AUDIT FAILURE - Audit entry write failed:", error);
      // In production security posture, do not swallow fatal audit failures
      throw error;
    }
  }
}

module.exports = AuditService;
