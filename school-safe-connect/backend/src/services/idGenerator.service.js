/**
 * Hierarchical Identity Code Generator Service
 * Employs MongoDB atomic findOneAndUpdate with $inc for concurrency-safe sequential code generation.
 * Enforces immutability and non-reuse.
 *
 * Implements Section 8 Identity Code System:
 * - School: SSC-SCH-1023, SSC-SCH-2045
 * - Super Admin: SSC-GSA-001
 * - School Admin: SSC-SCH-1023-ADM-001
 * - Teacher: SSC-SCH-1023-TCH-001
 * - Parent: SSC-SCH-1023-PAR-015
 * - Driver: SSC-SCH-1023-DRV-003
 * - Student: SSC-SCH-1023-STU-102
 * - Class: SSC-SCH-1023-CLS-6A
 * - Bus: SSC-SCH-1023-BUS-012
 * - Camera: SSC-SCH-1023-CAM-004
 * - Incident: SSC-SCH-1023-INC-001
 * - PanicAlert: SSC-SCH-1023-PAN-001
 */

const { Counter } = require("../models");
const { ROLES, IDENTITY_PREFIX } = require("../config/constants");
const logger = require("../utils/logger");

class IdGeneratorService {
  /**
   * Atomically increments and fetches the next sequence value
   * @param {string} sequenceName
   * @param {string} schoolCode
   * @param {number} startOffset
   * @returns {Promise<number>}
   */
  static async getNextSequence(sequenceName, schoolCode = "GLOBAL", startOffset = 1) {
    const counter = await Counter.findOneAndUpdate(
      { sequenceName, schoolCode },
      { $inc: { sequenceValue: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    // If counter is brand new and startOffset > 1, adjust
    if (counter.sequenceValue === 1 && startOffset > 1) {
      counter.sequenceValue = startOffset;
      await counter.save();
    }

    return counter.sequenceValue;
  }

  /**
   * Generates next School Code: SSC-SCH-XXXX serially starting from 1001 (e.g. SSC-SCH-1001, SSC-SCH-1002, ...)
   */
  static async generateSchoolCode() {
    const seq = await this.getNextSequence("SCHOOL_CODE", "GLOBAL", 1001);
    const code = `${IDENTITY_PREFIX.SCHOOL}-${seq.toString().padStart(4, "0")}`;
    logger.info(`Generated hierarchical serial schoolCode: ${code}`);
    return code;
  }

  /**
   * Generates next Global Super Admin Code: SSC-GSA-001
   */
  static async generateSuperAdminCode() {
    const seq = await this.getNextSequence("SUPER_ADMIN_CODE", "GLOBAL", 1);
    return `${IDENTITY_PREFIX.SUPER_ADMIN}-${seq.toString().padStart(3, "0")}`;
  }

  /**
   * Generates next User Code based on Role and School (Section 8)
   * School Admin uses the direct school identifier: SSC-SCH-XXXX
   * Internal staff / parents / drivers use: SSC-SCH-XXXX-TCH-001, SSC-SCH-XXXX-PAR-001, etc.
   */
  static async generateUserCode(schoolCode, role) {
    if (role === ROLES.SCHOOL_ADMIN) {
      // School Admin user ID is simply the school code: SSC-SCH-XXXX
      logger.info(`Assigned School Admin userCode directly as: ${schoolCode}`);
      return schoolCode;
    }

    let prefix = "";
    switch (role) {
    case ROLES.TRANSPORT_COORDINATOR:
      prefix = "TRC";
      break;
    case ROLES.CLASS_TEACHER:
    case ROLES.SUBJECT_TEACHER:
      prefix = IDENTITY_PREFIX.TEACHER; // TCH
      break;
    case ROLES.PARENT:
      prefix = IDENTITY_PREFIX.PARENT; // PAR
      break;
    case ROLES.DRIVER:
      prefix = IDENTITY_PREFIX.DRIVER; // DRV
      break;
    default:
      throw new Error(`Unsupported role for user code generation: ${role}`);
    }

    const seq = await this.getNextSequence(`USER_${prefix}`, schoolCode, 1);
    const code = `${schoolCode}-${prefix}-${seq.toString().padStart(3, "0")}`;
    logger.info(`Generated hierarchical userCode for ${role}: ${code}`);
    return code;
  }

  /**
   * Generates Student Code: SSC-SCH-XXXX-STU-XXX (Section 8)
   */
  static async generateStudentCode(schoolCode) {
    const seq = await this.getNextSequence("STUDENT_CODE", schoolCode, 1);
    return `${schoolCode}-${IDENTITY_PREFIX.STUDENT}-${seq.toString().padStart(3, "0")}`;
  }

  /**
   * Generates Class Code: SSC-SCH-XXXX-CLS-<Grade><Section> (Section 8)
   */
  static formatClassCode(schoolCode, grade, section) {
    const cleanGrade = String(grade).trim().toUpperCase();
    const cleanSection = String(section).trim().toUpperCase();
    return `${schoolCode}-${IDENTITY_PREFIX.CLASS}-${cleanGrade}${cleanSection}`;
  }

  /**
   * Generates Bus Code: SSC-SCH-XXXX-BUS-XXX (Section 8)
   */
  static async generateBusCode(schoolCode) {
    const seq = await this.getNextSequence("BUS_CODE", schoolCode, 1);
    return `${schoolCode}-${IDENTITY_PREFIX.BUS}-${seq.toString().padStart(3, "0")}`;
  }

  /**
   * Generates Camera Code: SSC-SCH-XXXX-CAM-XXX (Section 8)
   */
  static async generateCameraCode(schoolCode) {
    const seq = await this.getNextSequence("CAMERA_CODE", schoolCode, 1);
    return `${schoolCode}-${IDENTITY_PREFIX.CAMERA}-${seq.toString().padStart(3, "0")}`;
  }

  /**
   * Generates Incident Code: SSC-SCH-XXXX-INC-XXX (tenant-scoped, atomic, non-reusable)
   */
  static async generateIncidentCode(schoolCode) {
    const seq = await this.getNextSequence("INCIDENT_CODE", schoolCode, 1);
    const code = `${schoolCode}-${IDENTITY_PREFIX.INCIDENT}-${seq.toString().padStart(3, "0")}`;
    logger.info(`Generated incident code: ${code}`);
    return code;
  }

  /**
   * Generates Panic Alert Code: SSC-SCH-XXXX-PAN-XXX (tenant-scoped, atomic, non-reusable)
   */
  static async generatePanicAlertCode(schoolCode) {
    const seq = await this.getNextSequence("PANIC_ALERT_CODE", schoolCode, 1);
    const code = `${schoolCode}-${IDENTITY_PREFIX.PANIC}-${seq.toString().padStart(3, "0")}`;
    logger.info(`Generated panic alert code: ${code}`);
    return code;
  }
}

module.exports = IdGeneratorService;
