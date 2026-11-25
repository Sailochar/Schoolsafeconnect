const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.resolve(__dirname, "../.env") });

async function checkSchool() {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://localhost:27017/school_safe_connect");
  const School = mongoose.model("School", new mongoose.Schema({}, { strict: false }));
  const User = mongoose.model("User", new mongoose.Schema({}, { strict: false }));
  
  const schools = await School.find({}, "code name contactEmail contactPhone address");
  console.log("All Schools:", JSON.stringify(schools, null, 2));

  const admin = await User.findOne({ email: "principal@gmail.com" }, "userCode fullName email role schoolCode");
  console.log("Admin for principal@gmail.com:", JSON.stringify(admin, null, 2));

  await mongoose.disconnect();
}
checkSchool().catch(console.error);
