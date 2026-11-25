/**
 * Production Pilot Seed Data Script (Section 7)
 * Populates exactly:
 * - 1 Global Super Admin
 * - 2 Schools (Example Public School: SSC-SCH-1023, Sunrise International School: SSC-SCH-2045)
 * - 2 School Admins
 * - 2 Transport Coordinators
 * - 70 Teachers (35 per school)
 * - 700 Parents (350 per school)
 * - 20 Drivers (10 per school)
 * - 800 Students (400 per school)
 * - 20 Buses (10 per school)
 * - 16 CCTV Cameras (8 per school)
 * - Classes, Sections, Parent-Student Links, Routes, Stops, Assignments, Incidents, Audit Logs
 */

const mongoose = require("mongoose");
const {
  SuperAdmin,
  School,
  User,
  Student,
  ParentStudentLink,
  Class,
  ClassTeacher,
  Bus,
  Route,
  Camera,
  Assignment,
  Notice,
  Incident,
  AuditLog,
  AcademicYear,
  Counter
} = require("../models");
const { hashPassword } = require("../utils/password");
const config = require("../config/env");
const { ROLES, USER_STATUS, PARENT_VERIFICATION_STATUS, NOTIFICATION_PRIORITY, INCIDENT_TYPES, INCIDENT_STATUS } = require("../config/constants");
const logger = require("../utils/logger");

const runSeed = async () => {
  try {
    logger.info("Connecting to MongoDB database for seeding...");
    await mongoose.connect(config.MONGODB.URI);
    logger.info("Connected. Clearing old seed documents...");

    // Clean existing data
    await Promise.all([
      SuperAdmin.deleteMany({}),
      School.deleteMany({}),
      User.deleteMany({}),
      Student.deleteMany({}),
      ParentStudentLink.deleteMany({}),
      Class.deleteMany({}),
      ClassTeacher.deleteMany({}),
      Bus.deleteMany({}),
      Route.deleteMany({}),
      Camera.deleteMany({}),
      Assignment.deleteMany({}),
      Notice.deleteMany({}),
      Incident.deleteMany({}),
      AcademicYear.deleteMany({}),
      Counter.deleteMany({})
    ]);

    const defaultPasswordHash = await hashPassword("PilotSecure2026!");

    // 1. Seed Global Super Admin (SSC-GSA-001)
    logger.info("Seeding Global Super Admin...");
    const superAdmin = new SuperAdmin({
      userCode: "SSC-GSA-001",
      fullName: "Global Security Director",
      email: "superadmin@schoolsafeconnect.internal",
      phone: "+919876543210",
      passwordHash: defaultPasswordHash,
      status: "ACTIVE",
      twoFactor: { method: "AUTHENTICATOR", isVerified: true }
    });
    await superAdmin.save();

    // 2. School Specifications
    const schoolsData = [
      {
        schoolCode: "SSC-SCH-1023",
        name: "Example Public School",
        board: "CBSE",
        city: "New Delhi",
        state: "Delhi",
        postalCode: "110001",
        contactPerson: "Dr. Ramesh Sharma",
        contactPhone: "+919811122233",
        email: "admin@examplepublic.edu"
      },
      {
        schoolCode: "SSC-SCH-2045",
        name: "Sunrise International School",
        board: "ICSE",
        city: "Bengaluru",
        state: "Karnataka",
        postalCode: "560001",
        contactPerson: "Dr. Anita Desai",
        contactPhone: "+919822233344",
        email: "admin@sunriseschool.edu"
      }
    ];

    for (const sData of schoolsData) {
      const { schoolCode, name, board, city, state, postalCode, contactPerson, contactPhone, email } = sData;
      logger.info(`Seeding Tenant: ${schoolCode} (${name})...`);

      // Create School Tenant
      const school = new School({
        schoolCode,
        name,
        board,
        address: { street: "100 Campus Avenue", city, state, postalCode, country: "India" },
        contactPerson: { name: contactPerson, phone: contactPhone, email },
        status: "ACTIVE",
        approvalDetails: {
          approvedBy: "SSC-GSA-001",
          approvedAt: new Date(),
          reason: "Verified pilot school enrollment and governing charter"
        },
        settings: {
          cctvGlobalEnabled: true,
          transportGlobalEnabled: true,
          defaultDelayedVisibilitySeconds: 30,
          timezone: "Asia/Kolkata"
        },
        studentCount: 400,
        teacherCount: 35,
        busCount: 10,
        cameraCount: 8
      });
      await school.save();

      // Create Academic Year
      const academicYear = new AcademicYear({
        schoolCode,
        academicYearCode: "2026-2027",
        yearName: "Academic Year 2026-2027",
        startDate: new Date("2026-04-01"),
        endDate: new Date("2027-03-31"),
        isCurrent: true
      });
      await academicYear.save();

      // Create School Admin (SSC-SCH-XXXX-ADM-001)
      const adminUserCode = `${schoolCode}-ADM-001`;
      const adminUser = new User({
        schoolCode,
        userCode: adminUserCode,
        role: ROLES.SCHOOL_ADMIN,
        fullName: `${name} Administrator`,
        email,
        phone: contactPhone,
        passwordHash: defaultPasswordHash,
        status: USER_STATUS.ACTIVE,
        twoFactor: { method: "SMS", isVerified: true },
        verificationDetails: { status: "VERIFIED", verifiedBy: "SSC-GSA-001", verifiedAt: new Date() }
      });
      await adminUser.save();

      // Create Transport Coordinator (SSC-SCH-XXXX-TRC-001)
      const trcUserCode = `${schoolCode}-TRC-001`;
      const trcUser = new User({
        schoolCode,
        userCode: trcUserCode,
        role: ROLES.TRANSPORT_COORDINATOR,
        fullName: `${name} Transport Head`,
        email: `transport@${schoolCode.toLowerCase()}.internal`,
        phone: `+9199${schoolCode.slice(-4)}0001`,
        passwordHash: defaultPasswordHash,
        status: USER_STATUS.ACTIVE,
        twoFactor: { method: "SMS", isVerified: true },
        verificationDetails: { status: "VERIFIED", verifiedBy: adminUserCode, verifiedAt: new Date() }
      });
      await trcUser.save();

      // Create 10 Classes (Grades 1 to 10, Section A)
      const createdClasses = [];
      for (let g = 1; g <= 10; g++) {
        const classCode = `${schoolCode}-CLS-${g}A`;
        const cls = new Class({
          schoolCode,
          classCode,
          grade: String(g),
          section: "A",
          academicYear: "2026-2027",
          roomNumber: `Room-${100 + g}`,
          capacity: 40,
          cctvAccess: {
            enabled: true,
            days: ["MON", "TUE", "WED", "THU", "FRI"],
            startTime: "08:30",
            endTime: "15:30",
            timezone: "Asia/Kolkata",
            maxSessionMinutes: 10,
            maxSessionsPerDay: 5,
            cooldownMinutes: 15,
            allowedCameraIds: [`${schoolCode}-CAM-00${Math.min(g, 8)}`],
            requiresTeacherApproval: true
          }
        });
        await cls.save();
        createdClasses.push(cls);
      }

      // Create 8 CCTV Cameras
      for (let c = 1; c <= 8; c++) {
        const cameraCode = `${schoolCode}-CAM-${String(c).padStart(3, "0")}`;
        const camera = new Camera({
          schoolCode,
          cameraCode,
          name: `Classroom Camera Grade ${c}-A`,
          location: `Building Alpha, Floor ${Math.ceil(c / 4)}, Room 10${c}`,
          classCode: `${schoolCode}-CLS-${c}A`,
          rtspUrl: `rtsp://stream.schoolsafeconnect.internal:8554/${schoolCode.toLowerCase()}_cam_${c}`,
          privacyZone: false,
          streamChannelKey: `${schoolCode.toLowerCase()}_cam_${c}`
        });
        await camera.save();
      }

      // Create 10 Drivers & 10 Buses & 10 Routes
      const createdBuses = [];
      for (let b = 1; b <= 10; b++) {
        const driverCode = `${schoolCode}-DRV-${String(b).padStart(3, "0")}`;
        const driverUser = new User({
          schoolCode,
          userCode: driverCode,
          role: ROLES.DRIVER,
          fullName: `Driver ${b} (${name.split(" ")[0]})`,
          email: `driver${b}@${schoolCode.toLowerCase()}.internal`,
          phone: `+9197${schoolCode.slice(-4)}${String(b).padStart(4, "0")}`,
          passwordHash: defaultPasswordHash,
          status: USER_STATUS.ACTIVE,
          twoFactor: { method: "SMS", isVerified: true },
          verificationDetails: { status: "VERIFIED", verifiedBy: adminUserCode, verifiedAt: new Date() }
        });
        await driverUser.save();

        const busCode = `${schoolCode}-BUS-${String(b).padStart(3, "0")}`;
        const bus = new Bus({
          schoolCode,
          busCode,
          busNumber: `Bus ${b}`,
          registrationNumber: `DL-01-${schoolCode.slice(-4)}-${1000 + b}`,
          capacity: 45,
          driverCode,
          routeCode: `${schoolCode}-RTE-${String(b).padStart(3, "0")}`,
          status: "ACTIVE",
          makeModel: "Tata Starbus 2025"
        });
        await bus.save();
        createdBuses.push(bus);

        const route = new Route({
          schoolCode,
          routeCode: `${schoolCode}-RTE-${String(b).padStart(3, "0")}`,
          routeName: `Route ${b} - Sector ${b * 5}`,
          startLocation: { name: "Main City Terminal", coordinates: [77.209, 28.6139] },
          endLocation: { name: `${name} Gate 1`, coordinates: [77.23, 28.63] },
          busCode,
          driverCode,
          stops: [
            { stopId: "ST-01", stopName: `Sector ${b * 5} Circle`, sequenceOrder: 1, scheduledPickupTime: "07:30", scheduledDropTime: "15:45", coordinates: [77.21, 28.615] },
            { stopId: "ST-02", stopName: `Green Park Point ${b}`, sequenceOrder: 2, scheduledPickupTime: "07:45", scheduledDropTime: "15:30", coordinates: [77.22, 28.62] }
          ]
        });
        await route.save();
      }

      // Create 35 Teachers per school
      logger.info(`Creating 35 teachers for ${schoolCode}...`);
      const createdTeachers = [];
      for (let t = 1; t <= 35; t++) {
        const teacherCode = `${schoolCode}-TCH-${String(t).padStart(3, "0")}`;
        const isClassTeacher = t <= 10; // First 10 are Class Teachers for Grades 1-10
        const teacherUser = new User({
          schoolCode,
          userCode: teacherCode,
          role: isClassTeacher ? ROLES.CLASS_TEACHER : ROLES.SUBJECT_TEACHER,
          fullName: `Teacher ${t} (${name.split(" ")[0]})`,
          email: `teacher${t}@${schoolCode.toLowerCase()}.internal`,
          phone: `+9196${schoolCode.slice(-4)}${String(t).padStart(4, "0")}`,
          passwordHash: defaultPasswordHash,
          status: USER_STATUS.ACTIVE,
          twoFactor: { method: "SMS", isVerified: true },
          verificationDetails: { status: "VERIFIED", verifiedBy: adminUserCode, verifiedAt: new Date() }
        });
        await teacherUser.save();
        createdTeachers.push(teacherUser);

        if (isClassTeacher) {
          const classAssignment = new ClassTeacher({
            schoolCode,
            classCode: `${schoolCode}-CLS-${t}A`,
            teacherCode,
            isClassTeacher: true,
            subject: "Mathematics",
            academicYear: "2026-2027"
          });
          await classAssignment.save();
        }
      }

      // Create 400 Students and 350 Parents per school
      // (40 students per each of the 10 classes)
      logger.info(`Creating 400 students and 350 parents for ${schoolCode}...`);
      const studentDocs = [];
      const parentDocs = [];
      const linkDocs = [];

      for (let p = 1; p <= 350; p++) {
        const parentCode = `${schoolCode}-PAR-${String(p).padStart(3, "0")}`;
        parentDocs.push({
          schoolCode,
          userCode: parentCode,
          role: ROLES.PARENT,
          fullName: `Parent of Student ${p}`,
          email: `parent${p}@${schoolCode.toLowerCase()}.internal`,
          phone: `+9195${schoolCode.slice(-4)}${String(p).padStart(4, "0")}`,
          passwordHash: defaultPasswordHash,
          status: USER_STATUS.ACTIVE,
          twoFactor: { method: "SMS", isVerified: true },
          verificationDetails: {
            status: PARENT_VERIFICATION_STATUS.VERIFIED,
            verifiedBy: adminUserCode,
            verifiedAt: new Date(),
            consentAccepted: true,
            consentAcceptedAt: new Date()
          }
        });
      }
      await User.insertMany(parentDocs);

      for (let s = 1; s <= 400; s++) {
        const studentCode = `${schoolCode}-STU-${String(s).padStart(3, "0")}`;
        const gradeNum = Math.floor((s - 1) / 40) + 1; // 40 students per class (Grades 1 to 10)
        const classCode = `${schoolCode}-CLS-${gradeNum}A`;
        const busNum = (s % 10) + 1;
        const busCode = `${schoolCode}-BUS-${String(busNum).padStart(3, "0")}`;
        const routeCode = `${schoolCode}-RTE-${String(busNum).padStart(3, "0")}`;

        studentDocs.push({
          schoolCode,
          studentCode,
          admissionNumber: `ADM-${schoolCode.slice(-4)}-${1000 + s}`,
          fullName: `Student ${s} (${name.split(" ")[0]})`,
          dateOfBirth: new Date(2015, (s % 12), (s % 28) + 1),
          gender: s % 2 === 0 ? "MALE" : "FEMALE",
          classCode,
          section: "A",
          academicYear: "2026-2027",
          busCode,
          routeCode,
          stopId: "ST-01",
          emergencyContacts: [
            { name: `Emergency Contact ${s}`, phone: `+9195${schoolCode.slice(-4)}${String((s % 350) + 1).padStart(4, "0")}`, relationship: "FATHER" }
          ]
        });

        // Map to one of the 350 parents (some parents have 2 children)
        const parentIndex = ((s - 1) % 350) + 1;
        const parentCode = `${schoolCode}-PAR-${String(parentIndex).padStart(3, "0")}`;

        linkDocs.push({
          schoolCode,
          parentCode,
          studentCode,
          relationship: s % 2 === 0 ? "FATHER" : "MOTHER",
          isPrimaryContact: true,
          status: PARENT_VERIFICATION_STATUS.VERIFIED,
          verifiedBy: adminUserCode,
          verifiedAt: new Date()
        });
      }

      await Student.insertMany(studentDocs);
      await ParentStudentLink.insertMany(linkDocs);

      // Seed Pilot Academic Assignments
      const assignment = new Assignment({
        schoolCode,
        assignmentCode: `${schoolCode}-ASN-MATH-01`,
        classCode: `${schoolCode}-CLS-6A`,
        teacherCode: `${schoolCode}-TCH-006`,
        subject: "Mathematics",
        title: "Fractions and Decimals Exercise 3.2",
        description: "Complete problems 1 through 15 on pages 45-47.",
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        maxScore: 100,
        status: "PUBLISHED"
      });
      await assignment.save();

      // Seed Pilot School Notice
      const notice = new Notice({
        schoolCode,
        noticeCode: `${schoolCode}-NOT-SAFETY-01`,
        title: "Safety Drill & Bus Timing Advisory",
        content: "Annual safety preparedness drill will be conducted this Friday.",
        publishedBy: adminUserCode,
        targetRoles: ["PARENT", "CLASS_TEACHER", "SUBJECT_TEACHER"],
        classCodes: [`${schoolCode}-CLS-6A`],
        priority: NOTIFICATION_PRIORITY.IMPORTANT
      });
      await notice.save();

      // Seed Pilot Incident
      const incident = new Incident({
        schoolCode,
        incidentCode: `${schoolCode}-INC-001`,
        type: INCIDENT_TYPES.TRANSPORT_DELAY,
        severity: "LOW",
        reportedBy: `${schoolCode}-DRV-001`,
        busId: `${schoolCode}-BUS-001`,
        description: "Minor traffic blockage near Sector 5 crossing.",
        status: INCIDENT_STATUS.RESOLVED,
        statusHistory: [
          { status: INCIDENT_STATUS.OPEN, changedBy: `${schoolCode}-DRV-001`, remarks: "Reported delay", changedAt: new Date(Date.now() - 3600000) },
          { status: INCIDENT_STATUS.RESOLVED, changedBy: adminUserCode, remarks: "Bus reached destination", changedAt: new Date() }
        ]
      });
      await incident.save();

      // Seed Initial Audit Logs
      await AuditLog.create({
        logId: `AUD-${Date.now()}-${schoolCode}-INIT`,
        schoolCode,
        actor: { userCode: adminUserCode, role: ROLES.SCHOOL_ADMIN, fullName: adminUser.fullName, email: adminUser.email },
        action: "TENANT_INITIALIZED",
        resourceType: "TENANT",
        resourceId: schoolCode,
        reason: "Initial pilot database seed executed",
        ipAddress: "127.0.0.1"
      });
    }

    logger.info("========================================================");
    logger.info("PILOT DATABASE SEEDING COMPLETE");
    logger.info("Total Schools: 2 (Example Public School, Sunrise International School)");
    logger.info("Total Students: 800 (400 per school)");
    logger.info("Total Parents: 700 (350 per school)");
    logger.info("Total Teachers: 70 (35 per school)");
    logger.info("Total Drivers: 20 (10 per school)");
    logger.info("Total Buses: 20 (10 per school)");
    logger.info("Total Cameras: 16 (8 per school)");
    logger.info("Global Super Admin: SSC-GSA-001 (superadmin@schoolsafeconnect.internal)");
    logger.info("School 1 Admin: SSC-SCH-1023-ADM-001 (admin@examplepublic.edu)");
    logger.info("School 2 Admin: SSC-SCH-2045-ADM-001 (admin@sunriseschool.edu)");
    logger.info("Default Password for all seeded accounts: PilotSecure2026!");
    logger.info("========================================================");

    process.exit(0);
  } catch (error) {
    logger.error("Fatal error during pilot seeding:", error);
    process.exit(1);
  }
};

if (require.main === module) {
  runSeed();
}

module.exports = runSeed;
