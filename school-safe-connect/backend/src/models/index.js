/**
 * Central Model Registry for School Safe Connect
 */

const SuperAdmin = require("./SuperAdmin");
const School = require("./School");
const OnboardingRequest = require("./OnboardingRequest");
const User = require("./User");
const Student = require("./Student");
const ParentStudentLink = require("./ParentStudentLink");
const Class = require("./Class");
const ClassTeacher = require("./ClassTeacher");
const Assignment = require("./Assignment");
const AssignmentSubmission = require("./AssignmentSubmission");
const Notice = require("./Notice");
const ParentQuery = require("./ParentQuery");
const Incident = require("./Incident");
const PanicAlert = require("./PanicAlert");
const Bus = require("./Bus");
const Route = require("./Route");
const Stop = require("./Stop");
const Trip = require("./Trip");
const Location = require("./Location");
const Camera = require("./Camera");
const CctvAccessRequest = require("./CctvAccessRequest");
const CctvSession = require("./CctvSession");
const TransportAccessRequest = require("./TransportAccessRequest");
const Notification = require("./Notification");
const NotificationPreference = require("./NotificationPreference");
const Device = require("./Device");
const AuditLog = require("./AuditLog");
const Counter = require("./Counter");
const AcademicYear = require("./AcademicYear");
const Timetable = require("./Timetable");
const FeeRecord = require("./FeeRecord");
const SchoolEvent = require("./SchoolEvent");
const DailyTeacherAssignment = require("./DailyTeacherAssignment");
const Assessment = require("./Assessment");
const ReportCard = require("./ReportCard");

module.exports = {
  SuperAdmin,
  School,
  OnboardingRequest,
  User,
  Student,
  ParentStudentLink,
  Class,
  ClassTeacher,
  Assignment,
  AssignmentSubmission,
  Notice,
  ParentQuery,
  Incident,
  PanicAlert,
  Bus,
  Route,
  Stop,
  Trip,
  Location,
  Camera,
  CctvAccessRequest,
  CctvSession,
  TransportAccessRequest,
  Notification,
  NotificationPreference,
  Device,
  AuditLog,
  Counter,
  AcademicYear,
  Timetable,
  FeeRecord,
  SchoolEvent,
  DailyTeacherAssignment,
  Assessment,
  ReportCard
};
