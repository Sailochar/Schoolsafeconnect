const mongoose = require("mongoose");
const { Student, FeeRecord, SchoolEvent, School } = require("../models");

(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/school_safe_connect");
  const schoolCode = "SSC-SCH-1023";

  // Seed initial fees if none exist
  const existingFees = await FeeRecord.countDocuments({ schoolCode });
  if (existingFees === 0) {
    const students = await Student.find({ schoolCode }).limit(10).lean();
    for (let i = 0; i < students.length; i++) {
      const s = students[i];
      const isPaid = i % 3 === 0;
      const isPartial = i % 3 === 1;
      const amount = 15000 + i * 1200;
      const paidAmount = isPaid ? amount : isPartial ? 8000 : 0;
      const status = isPaid ? "PAID" : isPartial ? "PARTIAL" : "PENDING";
      const feeTypes = ["TUITION", "TRANSPORT", "TERM_1", "ANNUAL"];
      const feeType = feeTypes[i % feeTypes.length];

      await FeeRecord.create({
        schoolCode,
        studentCode: s.studentCode,
        admissionNumber: s.admissionNumber,
        studentName: s.fullName,
        classCode: s.classCode,
        feeType,
        amount,
        paidAmount,
        status,
        dueDate: new Date(Date.now() + (7 + i * 2) * 24 * 60 * 60 * 1000),
        paidAt: isPaid || isPartial ? new Date() : null,
        paymentMethod: isPaid ? "UPI" : isPartial ? "NET_BANKING" : null,
        receiptNumber: isPaid ? "REC-2026-" + s.admissionNumber + "-101" : null,
        parentName: "Parent of " + s.fullName,
        parentPhone: "+9198" + String(10000000 + i).slice(-8),
        parentEmail: "parent." + s.admissionNumber.toLowerCase() + "@example.com",
        notes: "Term 1 standard fee assessment"
      });
    }
    console.log("Seeded 10 Fee records.");
  }

  // Seed sample event if none exist
  const existingEvents = await SchoolEvent.countDocuments({ schoolCode });
  if (existingEvents === 0) {
    await SchoolEvent.create({
      schoolCode,
      title: "Inter-House Athletic Championship & Sports Meet 2026",
      description:
        "Over 400 students participated across sprint, relay, high-jump, and obstacle courses. Blue House emerged overall champions!",
      category: "SPORTS",
      eventDate: new Date(),
      images: [
        "https://images.unsplash.com/photo-1461896836934-ffe607ba8211?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1574629810360-7efbbe195018?auto=format&fit=crop&w=800&q=80",
        "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=80"
      ],
      uploader: {
        userCode: "SSC-SCH-1023-ADM-001",
        fullName: "Principal Greenwood",
        role: "SCHOOL_ADMIN"
      },
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
    });
    console.log("Seeded 1 sample School Event.");
  }

  // Connect WhatsApp in School Settings
  await School.updateOne(
    { schoolCode },
    {
      $set: {
        "settings.whatsapp": {
          connected: true,
          phoneNumber: "+91 98111 22233",
          businessAccountId: "WABA-SSC-SCH-1023",
          apiKey: "waba_prod_live_mock_key_2026",
          connectedAt: new Date(),
          status: "CONNECTED"
        }
      }
    }
  );
  console.log("Updated School WhatsApp settings.");

  process.exit(0);
})();
