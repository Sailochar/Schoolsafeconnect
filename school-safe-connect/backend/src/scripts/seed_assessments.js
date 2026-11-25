const mongoose = require("mongoose");
require("dotenv").config();
const { Assessment, ReportCard, Student, School } = require("../models");
const OmrEvaluationService = require("../services/omrEvaluation.service");

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log("Connected to MongoDB for assessment seeding...");

  // 1. Ensure WhatsApp is fully connected in both schools
  await School.updateMany(
    { schoolCode: { $in: ["SSC-SCH-1023", "SSC-SCH-1001"] } },
    {
      $set: {
        "settings.whatsapp": {
          connected: true,
          phoneNumber: "+919876543210",
          businessAccountId: "WABA-SSC-2026-LIVE",
          apiKey: "wh_live_key_983742987123",
          status: "CONNECTED",
          connectedAt: new Date(),
          lastTestedAt: new Date()
        }
      }
    }
  );
  console.log("Verified WhatsApp connection for schools.");

  // 2. Seed Assessment 1: FA-1 Mathematics for SSC-SCH-1023-CLS-6A
  const answerKey20 = [
    { questionNumber: 1, correctAnswer: "A" },
    { questionNumber: 2, correctAnswer: "C" },
    { questionNumber: 3, correctAnswer: "B" },
    { questionNumber: 4, correctAnswer: "D" },
    { questionNumber: 5, correctAnswer: "A" },
    { questionNumber: 6, correctAnswer: "B" },
    { questionNumber: 7, correctAnswer: "C" },
    { questionNumber: 8, correctAnswer: "D" },
    { questionNumber: 9, correctAnswer: "A" },
    { questionNumber: 10, correctAnswer: "C" },
    { questionNumber: 11, correctAnswer: "B" },
    { questionNumber: 12, correctAnswer: "A" },
    { questionNumber: 13, correctAnswer: "D" },
    { questionNumber: 14, correctAnswer: "C" },
    { questionNumber: 15, correctAnswer: "B" },
    { questionNumber: 16, correctAnswer: "A" },
    { questionNumber: 17, correctAnswer: "D" },
    { questionNumber: 18, correctAnswer: "C" },
    { questionNumber: 19, correctAnswer: "B" },
    { questionNumber: 20, correctAnswer: "A" }
  ];

  await Assessment.deleteMany({ schoolCode: "SSC-SCH-1023", classCode: "SSC-SCH-1023-CLS-6A" });
  await ReportCard.deleteMany({ schoolCode: "SSC-SCH-1023", classCode: "SSC-SCH-1023-CLS-6A" });

  const fa1 = await OmrEvaluationService.createAssessment({
    schoolCode: "SSC-SCH-1023",
    classCode: "SSC-SCH-1023-CLS-6A",
    title: "Formative Assessment 1 - Algebra & Geometry",
    assessmentType: "FA-1",
    subject: "Mathematics",
    academicYear: "2026-2027",
    totalQuestions: 20,
    marksPerQuestion: 1,
    negativeMarking: 0,
    answerKey: answerKey20,
    adminUser: { userCode: "SSC-SCH-1023-ADM-001", role: "SCHOOL_ADMIN", fullName: "School Administrator" }
  });

  console.log("Created FA-1 Assessment:", fa1._id);

  // Evaluate OMR batch for FA-1
  const evaluatedFA1 = await OmrEvaluationService.evaluateOmrBatch({
    schoolCode: "SSC-SCH-1023",
    assessmentId: fa1._id,
    adminUser: { userCode: "SSC-SCH-1023-ADM-001", role: "SCHOOL_ADMIN" }
  });
  console.log(`Evaluated FA-1: ${evaluatedFA1.results.length} students graded.`);

  // Publish to Report Cards
  const pubFA1 = await OmrEvaluationService.publishResultsToReportCards({
    schoolCode: "SSC-SCH-1023",
    assessmentId: fa1._id,
    notifyWhatsApp: false, // Don't spam during seed
    adminUser: { userCode: "SSC-SCH-1023-ADM-001", role: "SCHOOL_ADMIN" }
  });
  console.log(`Published FA-1: ${pubFA1.reportCardsUpdated} report cards updated.`);

  // 3. Seed Assessment 2: SA-1 Science for SSC-SCH-1023-CLS-6A
  const sa1 = await OmrEvaluationService.createAssessment({
    schoolCode: "SSC-SCH-1023",
    classCode: "SSC-SCH-1023-CLS-6A",
    title: "Summative Assessment 1 - Physical & Life Sciences",
    assessmentType: "SA-1",
    subject: "Science",
    academicYear: "2026-2027",
    totalQuestions: 20,
    marksPerQuestion: 2.5,
    negativeMarking: 0.5,
    answerKey: answerKey20,
    adminUser: { userCode: "SSC-SCH-1023-ADM-001", role: "SCHOOL_ADMIN", fullName: "School Administrator" }
  });

  const evaluatedSA1 = await OmrEvaluationService.evaluateOmrBatch({
    schoolCode: "SSC-SCH-1023",
    assessmentId: sa1._id,
    adminUser: { userCode: "SSC-SCH-1023-ADM-001", role: "SCHOOL_ADMIN" }
  });

  const pubSA1 = await OmrEvaluationService.publishResultsToReportCards({
    schoolCode: "SSC-SCH-1023",
    assessmentId: sa1._id,
    notifyWhatsApp: false,
    adminUser: { userCode: "SSC-SCH-1023-ADM-001", role: "SCHOOL_ADMIN" }
  });
  console.log(`Published SA-1: ${pubSA1.reportCardsUpdated} report cards updated.`);

  // 4. Also seed for SSC-SCH-1001 if students exist
  const students1001 = await Student.find({ schoolCode: "SSC-SCH-1001" }).lean();
  if (students1001.length > 0) {
    const classCode1001 = students1001[0].classCode;
    const fa1_1001 = await OmrEvaluationService.createAssessment({
      schoolCode: "SSC-SCH-1001",
      classCode: classCode1001,
      title: "Unit Assessment 1 - Core Mathematics",
      assessmentType: "FA-1",
      subject: "Mathematics",
      academicYear: "2026-2027",
      totalQuestions: 20,
      marksPerQuestion: 1,
      negativeMarking: 0,
      answerKey: answerKey20,
      adminUser: { userCode: "SSC-SCH-1001", role: "SCHOOL_ADMIN" }
    });
    await OmrEvaluationService.evaluateOmrBatch({
      schoolCode: "SSC-SCH-1001",
      assessmentId: fa1_1001._id,
      adminUser: { userCode: "SSC-SCH-1001", role: "SCHOOL_ADMIN" }
    });
    await OmrEvaluationService.publishResultsToReportCards({
      schoolCode: "SSC-SCH-1001",
      assessmentId: fa1_1001._id,
      notifyWhatsApp: false,
      adminUser: { userCode: "SSC-SCH-1001", role: "SCHOOL_ADMIN" }
    });
    console.log("Seeded assessment for SSC-SCH-1001.");
  }

  await mongoose.disconnect();
  console.log("Seeding complete!");
}

seed().catch(console.error);
