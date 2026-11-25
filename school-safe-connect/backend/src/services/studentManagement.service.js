/**
 * Student Management Extension Service
 * Handles modifying student details, class transfers, Excel bulk importing, and data exporting.
 */

const { Student, Class, ParentStudentLink, User, Counter } = require("../models");
const AuditService = require("./audit.service");

class StudentManagementService {
  /**
   * Modify existing student data
   */
  static async modifyStudent({
    schoolCode,
    studentCode,
    updateData = {},
    adminUser,
    ipAddress,
    userAgent
  }) {
    const student = await Student.findOne({ schoolCode, studentCode });
    if (!student) {
      throw new Error(`Student ${studentCode} not found.`);
    }

    const allowedFields = [
      "fullName",
      "dateOfBirth",
      "gender",
      "emergencyContacts",
      "busCode",
      "routeCode",
      "stopId",
      "status"
    ];

    allowedFields.forEach((f) => {
      if (updateData[f] !== undefined) {
        student[f] = updateData[f];
      }
    });

    await student.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "STUDENT_DATA_MODIFIED",
      resourceType: "STUDENT",
      resourceId: student.studentCode,
      ipAddress,
      userAgent,
      metadata: { studentCode, updatedFields: Object.keys(updateData) }
    });

    return student;
  }

  /**
   * Transfer a student to a different class / section
   */
  static async transferStudentClass({
    schoolCode,
    studentCode,
    targetClassCode,
    targetSection,
    targetAcademicYear,
    reason = "",
    adminUser,
    ipAddress,
    userAgent
  }) {
    const student = await Student.findOne({ schoolCode, studentCode });
    if (!student) {
      throw new Error(`Student ${studentCode} not found.`);
    }

    const previousClassCode = student.classCode;
    const previousSection = student.section;

    // Validate target class exists
    if (targetClassCode) {
      const cls = await Class.findOne({ schoolCode, classCode: targetClassCode });
      if (!cls) {
        throw new Error(`Target class ${targetClassCode} does not exist in school.`);
      }
      student.classCode = targetClassCode;
      student.section = targetSection || cls.section;
      if (targetAcademicYear) {
        student.academicYear = targetAcademicYear;
      }
    } else {
      throw new Error("Target classCode is required for transfer.");
    }

    await student.save();

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "STUDENT_CLASS_TRANSFERRED",
      resourceType: "STUDENT",
      resourceId: student.studentCode,
      reason,
      ipAddress,
      userAgent,
      metadata: {
        studentCode,
        fromClass: previousClassCode,
        fromSection: previousSection,
        toClass: student.classCode,
        toSection: student.section
      }
    });

    return {
      success: true,
      studentCode: student.studentCode,
      fullName: student.fullName,
      previousClass: previousClassCode,
      newClass: student.classCode,
      section: student.section,
      reason
    };
  }

  /**
   * Bulk import students from Excel / CSV parsed rows
   */
  static async bulkImportStudents({
    schoolCode,
    studentsData = [],
    adminUser,
    ipAddress,
    userAgent
  }) {
    if (!Array.isArray(studentsData) || studentsData.length === 0) {
      throw new Error("Students data array must not be empty.");
    }

    const imported = [];
    const skipped = [];

    // Get current counter for student codes
    const counterDoc = await Counter.findOneAndUpdate(
      { key: `${schoolCode}-STUDENT` },
      { $setOnInsert: { seq: 100 } },
      { upsert: true, new: true }
    );
    let currentSeq = counterDoc.seq;

    for (let i = 0; i < studentsData.length; i++) {
      const row = studentsData[i];
      const admissionNo = String(row.admissionNumber || row.admissionNo || row.admNo || `ADM-${Date.now()}-${i}`).trim();
      const fullName = String(row.fullName || row.name || row.studentName || "").trim();

      if (!fullName) {
        skipped.push({ row: i + 1, reason: "Missing student name" });
        continue;
      }

      // Check if admission number already exists
      const existing = await Student.findOne({ schoolCode, admissionNumber: admissionNo });
      if (existing) {
        skipped.push({ row: i + 1, admissionNo, reason: `Admission number ${admissionNo} already exists` });
        continue;
      }

      currentSeq += 1;
      const studentCode = `${schoolCode}-STU-${currentSeq}`;

      const grade = String(row.grade || row.class || "6").trim();
      const section = String(row.section || "A").trim().toUpperCase();
      const classCode = String(row.classCode || `${schoolCode}-CLS-${grade}${section}`).trim();
      const academicYear = String(row.academicYear || "2026-2027").trim();

      const rawDob = row.dateOfBirth || row.dob || "2014-06-01";
      const dateOfBirth = new Date(rawDob);

      let gender = String(row.gender || "MALE").trim().toUpperCase();
      if (!["MALE", "FEMALE", "OTHER"].includes(gender)) {
        gender = "MALE";
      }

      const emergencyContacts = [];
      if (row.parentPhone || row.phone || row.contactPhone) {
        emergencyContacts.push({
          name: row.parentName || row.guardianName || "Parent",
          phone: String(row.parentPhone || row.phone || row.contactPhone).trim(),
          relationship: row.relationship || "PARENT"
        });
      }

      try {
        const student = await Student.create({
          schoolCode,
          studentCode,
          admissionNumber: admissionNo,
          fullName,
          dateOfBirth: isNaN(dateOfBirth.getTime()) ? new Date("2014-06-01") : dateOfBirth,
          gender,
          classCode,
          section,
          academicYear,
          busCode: row.busCode ? String(row.busCode).trim() : undefined,
          emergencyContacts,
          status: "ACTIVE"
        });

        imported.push({
          studentCode: student.studentCode,
          admissionNumber: student.admissionNumber,
          fullName: student.fullName,
          classCode: student.classCode
        });
      } catch (err) {
        skipped.push({ row: i + 1, admissionNo, reason: err.message });
      }
    }

    // Update counter
    await Counter.updateOne({ key: `${schoolCode}-STUDENT` }, { $set: { seq: currentSeq } });

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName },
      action: "STUDENTS_EXCEL_IMPORT",
      resourceType: "STUDENT",
      ipAddress,
      userAgent,
      metadata: { totalProvided: studentsData.length, importedCount: imported.length, skippedCount: skipped.length }
    });

    return {
      importedCount: imported.length,
      skippedCount: skipped.length,
      imported,
      skipped
    };
  }

  /**
   * Export all students for the school
   */
  static async exportStudents({ schoolCode, classCode }) {
    const query = { schoolCode };
    if (classCode) {
      query.classCode = classCode;
    }

    const students = await Student.find(query).sort({ classCode: 1, admissionNumber: 1 }).lean();

    return students.map((s) => ({
      studentCode: s.studentCode,
      admissionNumber: s.admissionNumber,
      fullName: s.fullName,
      gender: s.gender,
      dateOfBirth: s.dateOfBirth ? new Date(s.dateOfBirth).toISOString().split("T")[0] : "",
      classCode: s.classCode,
      section: s.section,
      academicYear: s.academicYear,
      busCode: s.busCode || "",
      routeCode: s.routeCode || "",
      parentName: s.emergencyContacts?.[0]?.name || "",
      parentPhone: s.emergencyContacts?.[0]?.phone || "",
      status: s.status,
      enrolledAt: s.createdAt ? new Date(s.createdAt).toISOString().split("T")[0] : ""
    }));
  }
}

module.exports = StudentManagementService;
