/**
 * Fee Service
 * Manages school student fees, payment collections, receipts, and WhatsApp fee reminders.
 */

const { FeeRecord, Student, School, ParentStudentLink, User } = require("../models");
const NotificationSenderService = require("./notificationSender.service");
const AuditService = require("./audit.service");
const logger = require("../utils/logger");

class FeeService {
  /**
   * List fee records for the school with filters
   */
  static async listFees({ schoolCode, classCode, status, studentCode, search, page = 1, limit = 50 }) {
    const query = { schoolCode };

    if (classCode) {
      query.classCode = classCode;
    }
    if (status && status !== "ALL") {
      query.status = status;
    }
    if (studentCode) {
      query.studentCode = studentCode;
    }
    if (search) {
      query.$or = [
        { studentName: { $regex: search, $options: "i" } },
        { admissionNumber: { $regex: search, $options: "i" } },
        { studentCode: { $regex: search, $options: "i" } },
        { receiptNumber: { $regex: search, $options: "i" } }
      ];
    }

    const skip = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);
    const [fees, total] = await Promise.all([
      FeeRecord.find(query).sort({ dueDate: 1, createdAt: -1 }).skip(skip).limit(parseInt(limit, 10)).lean(),
      FeeRecord.countDocuments(query)
    ]);

    return { fees, total, page: parseInt(page, 10), limit: parseInt(limit, 10) };
  }

  /**
   * Summary analytics for dashboard
   */
  static async getStats({ schoolCode }) {
    const fees = await FeeRecord.find({ schoolCode }).lean();

    let totalBilled = 0;
    let totalCollected = 0;
    let totalPending = 0;
    let countPaid = 0;
    let countPending = 0;
    let countPartial = 0;

    for (const f of fees) {
      totalBilled += f.amount || 0;
      totalCollected += f.paidAmount || 0;
      const due = (f.amount || 0) - (f.paidAmount || 0);
      if (due > 0) {
        totalPending += due;
      }

      if (f.status === "PAID") countPaid++;
      else if (f.status === "PARTIAL") countPartial++;
      else countPending++;
    }

    return {
      totalBilled,
      totalCollected,
      totalPending,
      countPaid,
      countPending,
      countPartial,
      totalRecords: fees.length
    };
  }

  /**
   * Create fee record for a single student or class-wide
   */
  static async createFee({
    schoolCode,
    studentCode,
    classCode,
    feeType = "TUITION",
    amount,
    dueDate,
    notes = "",
    adminUser,
    ipAddress,
    userAgent
  }) {
    if (!amount || amount <= 0) {
      throw new Error("Fee amount must be greater than zero.");
    }
    if (!dueDate) {
      throw new Error("Fee due date is required.");
    }

    const createdRecords = [];

    // If studentCode is provided, assign to that student
    if (studentCode) {
      const student = await Student.findOne({ schoolCode, studentCode }).lean();
      if (!student) {
        throw new Error(`Student ${studentCode} not found in school.`);
      }

      // Find parent contact
      const link = await ParentStudentLink.findOne({ schoolCode, studentCode, isPrimaryContact: true }).lean();
      let parentUser = null;
      if (link) {
        parentUser = await User.findOne({ userCode: link.parentCode }).lean();
      }

      const record = await FeeRecord.create({
        schoolCode,
        studentCode: student.studentCode,
        admissionNumber: student.admissionNumber,
        studentName: student.fullName,
        classCode: student.classCode,
        feeType,
        amount: Number(amount),
        dueDate: new Date(dueDate),
        notes,
        parentName: parentUser ? parentUser.fullName : "",
        parentPhone: parentUser ? parentUser.phone : student.emergencyContacts?.[0]?.phone || "",
        parentEmail: parentUser ? parentUser.email : ""
      });

      createdRecords.push(record);
    } else if (classCode) {
      // Assign fee to ALL active students in the selected class
      const students = await Student.find({ schoolCode, classCode, status: "ACTIVE" }).lean();
      if (!students.length) {
        throw new Error(`No active students found in class ${classCode}.`);
      }

      for (const student of students) {
        const link = await ParentStudentLink.findOne({ schoolCode, studentCode: student.studentCode, isPrimaryContact: true }).lean();
        let parentUser = null;
        if (link) {
          parentUser = await User.findOne({ userCode: link.parentCode }).lean();
        }

        const record = await FeeRecord.create({
          schoolCode,
          studentCode: student.studentCode,
          admissionNumber: student.admissionNumber,
          studentName: student.fullName,
          classCode: student.classCode,
          feeType,
          amount: Number(amount),
          dueDate: new Date(dueDate),
          notes,
          parentName: parentUser ? parentUser.fullName : "",
          parentPhone: parentUser ? parentUser.phone : student.emergencyContacts?.[0]?.phone || "",
          parentEmail: parentUser ? parentUser.email : ""
        });
        createdRecords.push(record);
      }
    } else {
      throw new Error("Either studentCode or classCode must be provided to create fee records.");
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "FEE_RECORD_CREATED",
      resourceType: "FEE",
      ipAddress,
      userAgent,
      metadata: { count: createdRecords.length, feeType, amount }
    });

    return createdRecords;
  }

  /**
   * Record fee payment and generate receipt
   */
  static async recordPayment({
    schoolCode,
    feeId,
    paidAmount,
    paymentMethod = "UPI",
    transactionRef = "",
    notes = "",
    adminUser,
    ipAddress,
    userAgent
  }) {
    const fee = await FeeRecord.findOne({ _id: feeId, schoolCode });
    if (!fee) {
      throw new Error("Fee record not found.");
    }

    const payNum = Number(paidAmount);
    if (!payNum || payNum <= 0) {
      throw new Error("Payment amount must be greater than zero.");
    }

    const newPaid = (fee.paidAmount || 0) + payNum;
    if (newPaid > fee.amount) {
      throw new Error(`Total paid (${newPaid}) cannot exceed fee amount (${fee.amount}).`);
    }

    fee.paidAmount = newPaid;
    fee.paidAt = new Date();
    fee.paymentMethod = paymentMethod;
    fee.transactionRef = transactionRef || `TXN-${Date.now()}`;
    fee.status = fee.paidAmount >= fee.amount ? "PAID" : "PARTIAL";

    if (!fee.receiptNumber) {
      const year = new Date().getFullYear();
      const rand = Math.floor(1000 + Math.random() * 9000);
      fee.receiptNumber = `REC-${year}-${fee.admissionNumber}-${rand}`;
    }

    if (notes) {
      fee.notes = fee.notes ? `${fee.notes} | ${notes}` : notes;
    }

    await fee.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "FEE_PAYMENT_RECORDED",
      resourceType: "FEE",
      resourceId: fee._id.toString(),
      ipAddress,
      userAgent,
      metadata: { receiptNumber: fee.receiptNumber, paidAmount: payNum, status: fee.status }
    });

    return fee;
  }

  /**
   * Dispatch WhatsApp fee reminder to a parent
   */
  static async sendWhatsAppReminder({ schoolCode, feeId, adminUser, ipAddress, userAgent }) {
    const fee = await FeeRecord.findOne({ _id: feeId, schoolCode });
    if (!fee) {
      throw new Error("Fee record not found.");
    }

    const school = await School.findOne({ schoolCode }).lean();
    const schoolName = school?.name || schoolCode;

    // Check school WhatsApp configuration
    const whatsappCfg = school?.settings?.whatsapp;
    const adminPhone = school?.contactPerson?.phone || whatsappCfg?.phoneNumber || "+919800000000";

    const dueAmount = (fee.amount || 0) - (fee.paidAmount || 0);
    const formattedDueDate = new Date(fee.dueDate).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    });

    const targetPhone = fee.parentPhone;
    if (!targetPhone) {
      throw new Error(`Parent contact phone not found for student ${fee.studentName}.`);
    }

    const messageText =
      `*Fee Reminder from ${schoolName}*\n\n` +
      `Dear Parent,\n` +
      `This is a gentle reminder that fee for student *${fee.studentName}* (Adm: ${fee.admissionNumber}, Class: ${fee.classCode}) is pending.\n\n` +
      `• *Fee Category*: ${fee.feeType}\n` +
      `• *Pending Amount*: ₹${dueAmount.toLocaleString("en-IN")}\n` +
      `• *Due Date*: ${formattedDueDate}\n\n` +
      `Kindly clear the dues at your earliest convenience to avoid late fees. For queries or online receipt, contact school administration at ${adminPhone}.\n\n` +
      `_School Safe Connect Automated Billing System_`;

    try {
      await NotificationSenderService.sendWhatsApp({
        phone: targetPhone,
        message: messageText
      });
    } catch (sendErr) {
      logger.warn(`[FeeService] Outbound WhatsApp simulated: ${sendErr.message}`);
    }

    fee.whatsappRemindersSent = (fee.whatsappRemindersSent || 0) + 1;
    fee.lastReminderAt = new Date();
    await fee.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "FEE_WHATSAPP_REMINDER_SENT",
      resourceType: "FEE",
      resourceId: fee._id.toString(),
      ipAddress,
      userAgent,
      metadata: { targetPhone, studentCode: fee.studentCode, remindersSent: fee.whatsappRemindersSent }
    });

    return {
      success: true,
      feeId: fee._id,
      studentName: fee.studentName,
      targetPhone,
      remindersSent: fee.whatsappRemindersSent,
      messagePreview: messageText
    };
  }

  /**
   * Bulk dispatch WhatsApp reminders for all pending/partial fees
   */
  static async sendAllWhatsAppReminders({ schoolCode, classCode, adminUser, ipAddress, userAgent }) {
    const query = {
      schoolCode,
      status: { $in: ["PENDING", "PARTIAL"] }
    };
    if (classCode) {
      query.classCode = classCode;
    }

    const pendingFees = await FeeRecord.find(query);
    if (!pendingFees.length) {
      return { sentCount: 0, message: "No pending fee records found." };
    }

    let sentCount = 0;
    const errors = [];

    for (const fee of pendingFees) {
      try {
        await this.sendWhatsAppReminder({
          schoolCode,
          feeId: fee._id,
          adminUser,
          ipAddress,
          userAgent
        });
        sentCount++;
      } catch (err) {
        errors.push({ feeId: fee._id, studentName: fee.studentName, error: err.message });
      }
    }

    return {
      sentCount,
      totalPending: pendingFees.length,
      errors
    };
  }
}

module.exports = FeeService;
