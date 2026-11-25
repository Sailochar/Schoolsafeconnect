/**
 * Timetable Service
 * Manages School Admin generated class timetables, resolves active teacher/parent schedules,
 * and evaluates live CCTV access rules:
 *  - Starting 12 mins of each session -> 12 mins live preview (720s)
 *  - Ending 12 mins of each session   -> 12 mins live preview (720s)
 *  - In between class (middle)        -> 1 min live preview (60s)
 *  - Outside scheduled timetable/break -> Blocked with next session details
 */

const { Timetable, Class, ClassTeacher, Student, ParentStudentLink, User } = require("../models");
const AuditService = require("./audit.service");
const { ROLES, PARENT_VERIFICATION_STATUS } = require("../config/constants");

const DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function parseTimeToMinutes(hhmm) {
  if (!hhmm || typeof hhmm !== "string") return null;
  const parts = hhmm.trim().split(":");
  if (parts.length < 2) return null;
  const h = parseInt(parts[0], 10);
  const m = parseInt(parts[1], 10);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function formatMinutesToHHMM(totalMinutes) {
  const clamped = ((totalMinutes % 1440) + 1440) % 1440;
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

class TimetableService {
  /**
   * Evaluates current CCTV permission & live preview duration for a class based on its timetable.
   */
  static async evaluateCctvTimetableWindow({ schoolCode, classCode, now = new Date() }) {
    const dayOfWeek = DAYS[now.getDay()];
    const nowMin = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;

    const todayDoc = await Timetable.findOne({ schoolCode, classCode, dayOfWeek }).lean();
    const anyTimetableExists = todayDoc || (await Timetable.exists({ schoolCode, classCode }));

    // If School Admin hasn't generated a timetable for this class yet, return default 12-min policy
    if (!anyTimetableExists) {
      return {
        hasTimetable: false,
        allowed: true,
        windowType: "NO_TIMETABLE_CONFIGURED",
        windowLabel: "Default 12-Min Preview (Generate Timetable in School Admin)",
        allowedDurationSeconds: 720,
        activeSession: null,
        nextSession: null,
        dayOfWeek
      };
    }

    const sessions = [...(todayDoc?.sessions || [])].sort(
      (a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0)
    );
    const boundaryMin = todayDoc?.cctvPolicy?.boundaryWindowMinutes || 12;
    const midSeconds = todayDoc?.cctvPolicy?.midSessionPreviewSeconds || 60;

    let activeSession = null;
    let nextSession = null;

    for (const s of sessions) {
      const startMin = parseTimeToMinutes(s.startTime);
      const endMin = parseTimeToMinutes(s.endTime);
      if (startMin === null || endMin === null) continue;

      if (nowMin >= startMin && nowMin < endMin) {
        activeSession = { ...s, startMin, endMin };
        break;
      }
      if (startMin > nowMin && !nextSession && !s.isBreak) {
        nextSession = s;
      }
    }

    if (!activeSession) {
      return {
        hasTimetable: true,
        allowed: false,
        windowType: "OUTSIDE_TIMETABLE",
        windowLabel: "Outside Timetable Session",
        allowedDurationSeconds: 0,
        activeSession: null,
        nextSession,
        dayOfWeek,
        reason: nextSession
          ? `CCTV access follows the school timetable (${boundaryMin} min at session start/end, ${Math.round(midSeconds / 60)} min mid-class). Next session: ${nextSession.subject} (${nextSession.startTime} - ${nextSession.endTime}).`
          : `No active timetable session right now (${dayOfWeek} ${formatMinutesToHHMM(Math.floor(nowMin))}). CCTV is restricted to scheduled class sessions.`
      };
    }

    if (activeSession.isBreak) {
      return {
        hasTimetable: true,
        allowed: false,
        windowType: "BREAK_TIME",
        windowLabel: `Break (${activeSession.title})`,
        allowedDurationSeconds: 0,
        activeSession,
        nextSession,
        dayOfWeek,
        reason: `Class is currently on break (${activeSession.title}: ${activeSession.startTime} - ${activeSession.endTime}). Live CCTV resumes during the next scheduled period.`
      };
    }

    const elapsedMin = nowMin - activeSession.startMin;
    const remainingMin = activeSession.endMin - nowMin;

    // 1. Starting 12 mins of the session -> 12 mins live preview
    if (elapsedMin < boundaryMin) {
      const remainingBoundarySec = Math.max(60, Math.min(boundaryMin * 60, Math.ceil((boundaryMin - elapsedMin) * 60)));
      const sessionRemainingSec = Math.max(60, Math.ceil(remainingMin * 60));
      return {
        hasTimetable: true,
        allowed: true,
        windowType: "SESSION_START_WINDOW",
        windowLabel: `Session Start Window (${boundaryMin}m Live Preview)`,
        allowedDurationSeconds: Math.min(boundaryMin * 60, Math.max(remainingBoundarySec, Math.min(boundaryMin * 60, sessionRemainingSec))),
        maxWindowMinutes: boundaryMin,
        activeSession,
        nextSession,
        dayOfWeek
      };
    }

    // 2. Ending 12 mins of the session -> 12 mins live preview
    if (remainingMin <= boundaryMin) {
      const allowedSec = Math.max(60, Math.min(boundaryMin * 60, Math.ceil(remainingMin * 60)));
      return {
        hasTimetable: true,
        allowed: true,
        windowType: "SESSION_END_WINDOW",
        windowLabel: `Session Ending Window (${boundaryMin}m Live Preview)`,
        allowedDurationSeconds: allowedSec,
        maxWindowMinutes: boundaryMin,
        activeSession,
        nextSession,
        dayOfWeek
      };
    }

    // 3. In-between class (middle of session) -> Strictly 1 min (60s) live preview!
    return {
      hasTimetable: true,
      allowed: true,
      windowType: "MID_CLASS_QUICK_CHECK",
      windowLabel: "Mid-Class Quick Check (1-Min Preview Only)",
      allowedDurationSeconds: midSeconds, // 60 seconds
      maxWindowMinutes: 1,
      activeSession,
      nextSession,
      dayOfWeek
    };
  }

  /**
   * Saves a single day's timetable for a class and syncs teacher-class assignments automatically.
   */
  static async saveClassDayTimetable({ schoolCode, classCode, dayOfWeek, sessions = [], academicYear = "2026-2027", adminUser, ipAddress, userAgent }) {
    const cleanClass = String(classCode).trim().toUpperCase();
    const cleanDay = String(dayOfWeek).trim().toUpperCase();
    if (!DAYS.includes(cleanDay)) {
      const err = new Error(`Invalid dayOfWeek [${dayOfWeek}].`);
      err.statusCode = 400;
      throw err;
    }

    const cls = await Class.findOne({ schoolCode, classCode: cleanClass });
    if (!cls) {
      const err = new Error(`Class [${cleanClass}] not found in school.`);
      err.statusCode = 404;
      throw err;
    }

    // Resolve teacher names & normalize sessions
    const teacherCodes = [...new Set(sessions.map((s) => s.teacherCode).filter(Boolean).map((t) => String(t).trim().toUpperCase()))];
    const teacherDocs = teacherCodes.length
      ? await User.find({ schoolCode, userCode: { $in: teacherCodes } }).select("userCode fullName").lean()
      : [];
    const teacherMap = new Map(teacherDocs.map((t) => [t.userCode, t.fullName]));

    const normalized = sessions.map((s, idx) => {
      const tCode = s.teacherCode ? String(s.teacherCode).trim().toUpperCase() : undefined;
      return {
        sessionId: s.sessionId || `${cleanClass}-${cleanDay}-P${idx + 1}`,
        periodNumber: s.periodNumber || idx + 1,
        title: s.title || (s.isBreak ? "Break" : `Period ${idx + 1} - ${s.subject || "General"}`),
        subject: s.subject || (s.isBreak ? "BREAK" : "General"),
        teacherCode: s.isBreak ? undefined : tCode,
        teacherName: s.isBreak ? undefined : (s.teacherName || (tCode ? teacherMap.get(tCode) : undefined)),
        startTime: String(s.startTime || "09:00").trim(),
        endTime: String(s.endTime || "09:45").trim(),
        isBreak: Boolean(s.isBreak)
      };
    });

    const doc = await Timetable.findOneAndUpdate(
      { schoolCode, classCode: cleanClass, dayOfWeek: cleanDay },
      {
        $set: {
          schoolCode,
          classCode: cleanClass,
          academicYear,
          dayOfWeek: cleanDay,
          sessions: normalized,
          cctvPolicy: {
            boundaryWindowMinutes: 12,
            midSessionPreviewSeconds: 60,
            enforceTimetable: true
          },
          updatedBy: adminUser.userCode
        }
      },
      { upsert: true, new: true }
    );

    // Automatically ensure teachers scheduled in this timetable have active ClassTeacher access
    for (const s of normalized) {
      if (!s.isBreak && s.teacherCode) {
        await ClassTeacher.findOneAndUpdate(
          { schoolCode, classCode: cleanClass, teacherCode: s.teacherCode },
          {
            $set: {
              subject: s.subject,
              academicYear,
              status: "ACTIVE"
            },
            $setOnInsert: { isClassTeacher: false }
          },
          { upsert: true }
        );
      }
    }

    await AuditService.log({
      schoolCode,
      actor: { userCode: adminUser.userCode, role: adminUser.role, fullName: adminUser.fullName, email: adminUser.email },
      action: "TIMETABLE_UPDATED",
      resourceType: "TIMETABLE",
      resourceId: `${cleanClass}:${cleanDay}`,
      reason: "School Admin configured class timetable",
      ipAddress,
      userAgent,
      metadata: { sessionCount: normalized.length }
    });

    return doc;
  }

  /**
   * Auto-generates a complete weekly timetable for a class (MON-SAT + optional active demo session right now).
   */
  static async generateWeeklyTimetable({
    schoolCode,
    classCode,
    startTime = "09:00",
    periodMinutes = 45,
    periodsPerDay = 6,
    includeCurrentTimeSession = true,
    days = ["MON", "TUE", "WED", "THU", "FRI", "SAT"],
    adminUser,
    ipAddress,
    userAgent
  }) {
    const cleanClass = String(classCode).trim().toUpperCase();
    const cls = await Class.findOne({ schoolCode, classCode: cleanClass });
    if (!cls) {
      const err = new Error(`Class [${cleanClass}] not found.`);
      err.statusCode = 404;
      throw err;
    }

    const teachers = await User.find({
      schoolCode,
      role: { $in: [ROLES.CLASS_TEACHER, ROLES.SUBJECT_TEACHER] },
      status: "ACTIVE"
    }).select("userCode fullName").lean();

    const defaultSubjects = ["Mathematics", "Science", "English", "Social Studies", "Computer Science", "Hindi / Regional", "Physics", "Art & Activity"];
    const baseStartMin = parseTimeToMinutes(startTime) ?? 540; // 09:00
    const dur = Math.max(25, Math.min(90, parseInt(periodMinutes, 10) || 45));
    const count = Math.max(2, Math.min(10, parseInt(periodsPerDay, 10) || 6));

    const now = new Date();
    const todayName = DAYS[now.getDay()];
    const targetDays = [...new Set([...days.map((d) => d.toUpperCase()), ...(includeCurrentTimeSession ? [todayName] : [])])];

    const generated = [];
    for (let dIdx = 0; dIdx < targetDays.length; dIdx++) {
      const day = targetDays[dIdx];
      let cursor = baseStartMin;
      const sessions = [];

      for (let p = 0; p < count; p++) {
        // Insert lunch break after period 3
        if (p === 3) {
          sessions.push({
            sessionId: `${cleanClass}-${day}-BRK`,
            periodNumber: sessions.length + 1,
            title: "Lunch Break",
            subject: "BREAK",
            startTime: formatMinutesToHHMM(cursor),
            endTime: formatMinutesToHHMM(cursor + 30),
            isBreak: true
          });
          cursor += 30;
        }

        const subject = defaultSubjects[(p + dIdx) % defaultSubjects.length];
        const teacher = teachers.length > 0 ? teachers[(p + dIdx) % teachers.length] : null;
        sessions.push({
          sessionId: `${cleanClass}-${day}-P${p + 1}`,
          periodNumber: sessions.length + 1,
          title: `Period ${p + 1} - ${subject}`,
          subject,
          teacherCode: teacher?.userCode,
          teacherName: teacher?.fullName,
          startTime: formatMinutesToHHMM(cursor),
          endTime: formatMinutesToHHMM(cursor + dur),
          isBreak: false
        });
        cursor += dur;
      }

      // If requested, ensure today has an active live session right now so admin/parents/teachers can verify live CCTV & schedule immediately
      if (includeCurrentTimeSession && day === todayName) {
        const nowMin = now.getHours() * 60 + now.getMinutes();
        const alreadyActive = sessions.some((s) => {
          const sm = parseTimeToMinutes(s.startTime);
          const em = parseTimeToMinutes(s.endTime);
          return !s.isBreak && sm !== null && em !== null && nowMin >= sm && nowMin < em;
        });
        if (!alreadyActive) {
          const liveStart = Math.max(0, nowMin - 2); // 2 mins into session -> currently in 12-min starting live window!
          const liveEnd = Math.min(1439, liveStart + dur);
          const t = teachers[0] || null;
          sessions.push({
            sessionId: `${cleanClass}-${day}-LIVE`,
            periodNumber: sessions.length + 1,
            title: "Active Session - Mathematics",
            subject: "Mathematics",
            teacherCode: t?.userCode,
            teacherName: t?.fullName,
            startTime: formatMinutesToHHMM(liveStart),
            endTime: formatMinutesToHHMM(liveEnd),
            isBreak: false
          });
        }
      }

      const saved = await this.saveClassDayTimetable({
        schoolCode,
        classCode: cleanClass,
        dayOfWeek: day,
        sessions,
        adminUser,
        ipAddress,
        userAgent
      });
      generated.push(saved);
    }

    return { classCode: cleanClass, daysGenerated: generated.length, timetable: generated };
  }

  /**
   * Returns full weekly timetable for a class + live CCTV policy status right now.
   */
  static async getClassTimetable({ schoolCode, classCode }) {
    const cleanClass = String(classCode).trim().toUpperCase();
    const [docs, liveWindow] = await Promise.all([
      Timetable.find({ schoolCode, classCode: cleanClass }).lean(),
      this.evaluateCctvTimetableWindow({ schoolCode, classCode: cleanClass })
    ]);

    const byDay = {};
    for (const d of DAYS) {
      byDay[d] = docs.find((doc) => doc.dayOfWeek === d) || { dayOfWeek: d, sessions: [] };
    }

    return {
      classCode: cleanClass,
      days: byDay,
      today: DAYS[new Date().getDay()],
      cctvPolicy: {
        boundaryWindowMinutes: 12,
        midSessionPreviewSeconds: 60
      },
      liveStatus: liveWindow
    };
  }

  /**
   * Role-aware schedule endpoint for Teacher or Parent mobile app.
   */
  static async getMySchedule({ schoolCode, user }) {
    const today = DAYS[new Date().getDay()];
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();

    if (user.role === ROLES.PARENT) {
      const links = await ParentStudentLink.find({
        schoolCode,
        parentCode: user.userCode,
        status: PARENT_VERIFICATION_STATUS.VERIFIED
      }).lean();
      const studentCodes = links.map((l) => l.studentCode);
      const students = studentCodes.length
        ? await Student.find({ schoolCode, studentCode: { $in: studentCodes } }).lean()
        : [];

      const primaryStudent = students[0] || null;
      if (!primaryStudent || !primaryStudent.classCode) {
        return { role: "PARENT", today, classCode: null, todaySessions: [], week: {}, liveStatus: null };
      }

      const full = await this.getClassTimetable({ schoolCode, classCode: primaryStudent.classCode });
      return {
        role: "PARENT",
        today,
        studentCode: primaryStudent.studentCode,
        studentName: primaryStudent.fullName,
        classCode: primaryStudent.classCode,
        todaySessions: full.days[today]?.sessions || [],
        week: full.days,
        cctvPolicy: full.cctvPolicy,
        liveStatus: full.liveStatus
      };
    }

    // Teacher personal timetable across all classes they are scheduled in or assigned to
    const assigned = await ClassTeacher.find({ schoolCode, teacherCode: user.userCode, status: "ACTIVE" }).select("classCode").lean();
    const assignedClassCodes = assigned.map((a) => a.classCode);

    const allTimetables = await Timetable.find({
      schoolCode,
      $or: [
        { "sessions.teacherCode": user.userCode },
        ...(assignedClassCodes.length ? [{ classCode: { $in: assignedClassCodes } }] : [])
      ]
    }).lean();

    const weekByDay = {};
    for (const d of DAYS) weekByDay[d] = [];

    for (const tt of allTimetables) {
      for (const s of tt.sessions || []) {
        if (s.isBreak) continue;
        if (s.teacherCode === user.userCode || (!s.teacherCode && assignedClassCodes.includes(tt.classCode))) {
          weekByDay[tt.dayOfWeek].push({
            ...s,
            classCode: tt.classCode
          });
        }
      }
    }

    for (const d of DAYS) {
      weekByDay[d].sort((a, b) => (parseTimeToMinutes(a.startTime) ?? 0) - (parseTimeToMinutes(b.startTime) ?? 0));
    }

    const todaySessions = weekByDay[today] || [];
    let currentSession = null;
    let nextSession = null;
    for (const s of todaySessions) {
      const sm = parseTimeToMinutes(s.startTime);
      const em = parseTimeToMinutes(s.endTime);
      if (sm !== null && em !== null) {
        if (nowMin >= sm && nowMin < em) {
          currentSession = s;
        } else if (sm > nowMin && !nextSession) {
          nextSession = s;
        }
      }
    }

    return {
      role: user.role,
      today,
      assignedClasses: assignedClassCodes,
      todaySessions,
      week: weekByDay,
      currentSession,
      nextSession
    };
  }
}

module.exports = TimetableService;
