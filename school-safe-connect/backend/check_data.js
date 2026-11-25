const mongoose = require("mongoose");
const { User, Student, Class, Camera, ParentStudentLink, Bus } = require("./src/models");

(async () => {
  await mongoose.connect("mongodb://127.0.0.1:27017/school_safe_connect");
  
  const user = await User.findOne({ userCode: "SSC-SCH-1001-PAR-001" });
  console.log("USER:", user ? {
    id: user._id,
    userCode: user.userCode,
    fullName: user.fullName,
    role: user.role,
    status: user.status,
    verificationDetails: user.verificationDetails,
    accessControls: user.accessControls
  } : "NOT FOUND");
  
  const student = await Student.findOne({ studentCode: "SSC-SCH-1001-STU-001" });
  console.log("STUDENT:", student ? {
    studentCode: student.studentCode,
    fullName: student.fullName,
    classCode: student.classCode,
    status: student.status,
    transport: student.transport
  } : "NOT FOUND");
  
  const link = await ParentStudentLink.findOne({ parentCode: "SSC-SCH-1001-PAR-001" });
  console.log("LINK:", link ? {
    parentCode: link.parentCode,
    studentCode: link.studentCode,
    status: link.status
  } : "NOT FOUND");
  
  const cameras = await Camera.find({ schoolCode: "SSC-SCH-1001" });
  console.log("CAMERAS:", cameras.map(c => ({
    cameraCode: c.cameraCode,
    classCode: c.classCode,
    name: c.name,
    status: c.status
  })));
  
  const cls = await Class.findOne({ classCode: "SSC-SCH-1001-CLS-6A" });
  console.log("CLASS:", cls ? {
    classCode: cls.classCode,
    cctvAccess: cls.cctvAccess
  } : "NOT FOUND");

  const buses = await Bus.find({ schoolCode: "SSC-SCH-1001" });
  console.log("BUSES:", buses.map(b => ({
    busCode: b.busCode,
    registrationNumber: b.registrationNumber,
    driverCode: b.driverCode
  })));

  process.exit(0);
})();
