# School Safe Connect (SSC) - Database Schema Documentation

## Database: MongoDB Atlas (Multi-Tenant Logical Partitioning)

### Primary Collections and Indexing

| Collection | Key Fields | Primary Indexes |
| :--- | :--- | :--- |
| `SuperAdmin` | `userCode`, `email`, `phone`, `role`, `status` | `{ userCode: 1 }`, `{ email: 1 }` |
| `School` | `schoolCode`, `name`, `status`, `approvalDetails`, `settings` | `{ schoolCode: 1 }`, `{ status: 1 }` |
| `OnboardingRequest` | `requestId`, `schoolName`, `status`, `proposedAdminDetails` | `{ requestId: 1 }`, `{ status: 1 }` |
| `User` | `schoolCode`, `userCode`, `role`, `status`, `twoFactor` | `{ schoolCode: 1, role: 1 }`, `{ schoolCode: 1, email: 1 }` |
| `Student` | `schoolCode`, `studentCode`, `admissionNumber`, `classCode` | `{ schoolCode: 1, admissionNumber: 1 }`, `{ schoolCode: 1, classCode: 1 }` |
| `ParentStudentLink` | `schoolCode`, `parentCode`, `studentCode`, `status` | `{ schoolCode: 1, parentCode: 1, studentCode: 1 }` (Unique) |
| `Class` | `schoolCode`, `classCode`, `grade`, `section`, `cctvAccess` | `{ schoolCode: 1, grade: 1, section: 1 }` (Unique) |
| `ClassTeacher` | `schoolCode`, `classCode`, `teacherCode`, `isClassTeacher` | `{ schoolCode: 1, classCode: 1, teacherCode: 1 }` (Unique) |
| `Assignment` | `schoolCode`, `assignmentCode`, `classCode`, `dueDate` | `{ schoolCode: 1, classCode: 1, dueDate: -1 }` |
| `Notice` | `schoolCode`, `noticeCode`, `priority`, `targetRoles` | `{ schoolCode: 1, priority: 1, createdAt: -1 }` |
| `Incident` | `schoolCode`, `incidentCode`, `type`, `severity`, `status` | `{ schoolCode: 1, status: 1, createdAt: -1 }` |
| `PanicAlert` | `schoolCode`, `alertCode`, `triggeredBy`, `priority`, `status`| `{ schoolCode: 1, status: 1, createdAt: -1 }` |
| `Bus` | `schoolCode`, `busCode`, `registrationNumber`, `status` | `{ schoolCode: 1, registrationNumber: 1 }` (Unique) |
| `Route` | `schoolCode`, `routeCode`, `stops`, `status` | `{ schoolCode: 1, routeCode: 1 }` |
| `Stop` | `schoolCode`, `stopCode`, `routeCode`, `location` (GeoJSON) | `{ location: "2dsphere" }`, `{ schoolCode: 1, routeCode: 1 }` |
| `Trip` | `schoolCode`, `tripId`, `busCode`, `status`, `startedAt` | `{ schoolCode: 1, status: 1, createdAt: -1 }` |
| `Location` | `schoolCode`, `tripId`, `busCode`, `visibleAfter` | `{ schoolCode: 1, tripId: 1, visibleAfter: -1 }` |
| `Camera` | `schoolCode`, `cameraCode`, `classCode`, `rtspUrl` (Protected)| `{ schoolCode: 1, classCode: 1, status: 1 }` |
| `CctvAccessRequest` | `schoolCode`, `requestCode`, `parentCode`, `status` | `{ schoolCode: 1, parentCode: 1, validForDate: 1 }` |
| `CctvSession` | `sessionId`, `schoolCode`, `cameraId`, `parentCode`, `isActive`| `{ schoolCode: 1, parentCode: 1, isActive: 1 }` |
| `AuditLog` | `logId`, `schoolCode`, `actor`, `action`, `createdAt` | `{ schoolCode: 1, action: 1, createdAt: -1 }` (Immutable) |
| `Counter` | `sequenceName`, `schoolCode`, `sequenceValue` | `{ sequenceName: 1, schoolCode: 1 }` (Unique) |
| `AcademicYear` | `schoolCode`, `academicYearCode`, `isCurrent`, `isArchived` | `{ schoolCode: 1, academicYearCode: 1 }` (Unique) |
