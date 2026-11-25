'use strict';

const Attendance                  = require('./attendance.model');
const AttendanceCorrectionRequest = require('./attendanceCorrection.model');
const Course                      = require('../courses/course.model');
const Section                     = require('../sections/section.model');
const Semester                    = require('../semesters/semester.model');
const AcademicYear                = require('../academic-years/academicYear.model');
const Enrollment                  = require('../enrollments/enrollment.model');
const CourseAssignment            = require('../courses/courseAssignment.model');
const Notification                = require('../notifications/notification.model');
const Student                     = require('../students/student.model');
const SystemSetting               = require('../system/systemSetting.model');
const { getAttendancePolicy }     = require('../system/systemSettings.helper');
const AppError                    = require('../../utils/AppError');
const { runInTransaction }        = require('../../utils/transaction');
const { buildPaginationMeta }     = require('../../utils/apiResponse');
const { parsePagination }         = require('../../utils/queryHelpers');

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const normalizeSessionDate = (dateInput) => {
  const d = new Date(dateInput);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
};

const getPolicy = async () => getAttendancePolicy();

const updatePolicy = async (payload, actorId) => {
  const entries = [];
  if (payload.minimumPercentage !== undefined) {
    entries.push({ key: 'attendance.minimumPercentage', value: payload.minimumPercentage, dataType: 'number', group: 'attendance' });
  }
  if (payload.lateCountsAsPresent !== undefined) {
    entries.push({ key: 'attendance.lateCountsAsPresent', value: payload.lateCountsAsPresent, dataType: 'boolean', group: 'attendance' });
  }
  if (payload.editWindowHours !== undefined) {
    entries.push({ key: 'attendance.editWindowHours', value: payload.editWindowHours, dataType: 'number', group: 'attendance' });
  }

  for (const item of entries) {
    await SystemSetting.findOneAndUpdate(
      { key: item.key },
      { $set: { ...item, updatedBy: actorId } },
      { upsert: true, new: true }
    );
  }
  return getAttendancePolicy();
};

/**
 * Recalculate and persist Enrollment.attendancePercentage + isEligibleForExam
 * from actual Attendance sessions in MongoDB.
 */
const syncEnrollmentAttendance = async ({ studentIds, courseId, semesterId, session = null }) => {
  const policy = await getAttendancePolicy();
  const sessions = await Attendance.find({
    course  : courseId,
    semester: semesterId,
    'records.student': { $in: studentIds },
  }).session(session);

  for (const studentId of studentIds) {
    let totalClasses = 0;
    let attended     = 0;

    for (const sess of sessions) {
      const rec = sess.records.find((r) => String(r.student) === String(studentId));
      if (!rec || rec.status === 'cancelled') continue;
      totalClasses += 1;
      if (
        rec.status === 'present' ||
        rec.status === 'excused' ||
        (policy.lateCountsAsPresent && rec.status === 'late')
      ) {
        attended += 1;
      }
    }

    const percentage = totalClasses > 0 ? Number(((attended / totalClasses) * 100).toFixed(2)) : 0;
    const isEligible = totalClasses === 0 || percentage >= policy.minimumPercentage;

    await Enrollment.updateOne(
      { student: studentId, course: courseId, semester: semesterId },
      {
        $set: {
          attendancePercentage: percentage,
          isEligibleForExam   : isEligible,
          ineligibilityReason : isEligible
            ? null
            : `Attendance ${percentage}% is below minimum required ${policy.minimumPercentage}%`,
        },
      },
      { session }
    );
  }
};

const assertFacultyCourseAssignment = async ({ facultyProfileId, courseId, sectionId, semesterId }) => {
  if (!facultyProfileId) throw new AppError('Faculty profile is required', 403);
  const assigned = await CourseAssignment.exists({
    faculty : facultyProfileId,
    course  : courseId,
    section : sectionId,
    semester: semesterId,
    isActive: true,
  });
  if (!assigned) {
    throw new AppError('You are not assigned to teach this course and section.', 403);
  }
};

const createSession = async (payload, caller) => {
  const [course, section, semester, academicYear] = await Promise.all([
    Course.findById(payload.course),
    Section.findById(payload.section),
    Semester.findById(payload.semester),
    AcademicYear.findById(payload.academicYear),
  ]);

  if (!course || !course.isActive)   throw new AppError('Active course not found', 404);
  if (!section || !section.isActive) throw new AppError('Active section not found', 404);
  if (!semester)                     throw new AppError('Semester not found', 404);
  if (!academicYear)                 throw new AppError('Academic year not found', 404);

  let facultyId = caller.facultyProfile;
  if (caller.role === 'faculty') {
    await assertFacultyCourseAssignment({
      facultyProfileId: caller.facultyProfile,
      courseId        : course._id,
      sectionId       : section._id,
      semesterId      : semester._id,
    });
  } else {
    facultyId = payload.faculty;
    if (!facultyId) {
      const assignment = await CourseAssignment.findOne({
        course  : course._id,
        section : section._id,
        semester: semester._id,
        isActive: true,
      });
      if (!assignment) {
        throw new AppError('Specify faculty or create a CourseAssignment for this course/section/semester first', 400);
      }
      facultyId = assignment.faculty;
    }
  }

  // Prevent duplicate student entries in same session payload
  const seenStudents = new Set();
  for (const r of payload.records) {
    if (seenStudents.has(r.student)) {
      throw new AppError(`Duplicate attendance record for student ${r.student} in request`, 400);
    }
    seenStudents.add(r.student);
  }

  const studentIds = Array.from(seenStudents);

  // Ensure every student is actively enrolled in this course+section+semester
  const enrollments = await Enrollment.find({
    student : { $in: studentIds },
    course  : course._id,
    section : section._id,
    semester: semester._id,
    status  : { $in: ['enrolled', 'completed'] },
  }).select('_id student');

  const enrollByStudent = new Map(enrollments.map((e) => [String(e.student), e._id]));
  const missing = studentIds.filter((sid) => !enrollByStudent.has(sid));
  if (missing.length > 0) {
    throw new AppError(`Students not enrolled in this course/section/semester: ${missing.join(', ')}`, 400);
  }

  const normalizedDate = normalizeSessionDate(payload.date);
  const dayOfWeek = DAY_NAMES[normalizedDate.getUTCDay()];

  const mappedRecords = payload.records.map((r) => ({
    student   : r.student,
    enrollment: enrollByStudent.get(r.student),
    status    : r.status,
    remarks   : r.remarks,
    markedAt  : new Date(),
    markedBy  : caller.id,
  }));

  return runInTransaction(async (session) => {
    const [att] = await Attendance.create(
      [
        {
          course      : course._id,
          section     : section._id,
          semester    : semester._id,
          academicYear: academicYear._id,
          faculty     : facultyId,
          date        : normalizedDate,
          dayOfWeek,
          sessionType : payload.sessionType,
          periodNumber: payload.periodNumber,
          startTime   : payload.startTime,
          endTime     : payload.endTime,
          topic       : payload.topic,
          records     : mappedRecords,
          isFinalized : Boolean(payload.isFinalized),
          finalizedAt : payload.isFinalized ? new Date() : undefined,
          finalizedBy : payload.isFinalized ? caller.id : undefined,
          remarks     : payload.remarks,
        },
      ],
      { session }
    );

    await syncEnrollmentAttendance({
      studentIds,
      courseId  : course._id,
      semesterId: semester._id,
      session,
    });

    return att;
  });
};

const listSessions = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)                 filter.course = query.course;
  if (query.section)                filter.section = query.section;
  if (query.semester)               filter.semester = query.semester;
  if (query.academicYear)           filter.academicYear = query.academicYear;
  if (query.isFinalized !== undefined) filter.isFinalized = query.isFinalized;
  if (query.from || query.to) {
    filter.date = {};
    if (query.from) filter.date.$gte = normalizeSessionDate(query.from);
    if (query.to)   filter.date.$lte = normalizeSessionDate(query.to);
  }

  if (caller.role === 'faculty') {
    filter.faculty = caller.facultyProfile;
  } else if (query.faculty) {
    filter.faculty = query.faculty;
  }

  const [sessions, total] = await Promise.all([
    Attendance.find(filter)
      .populate('course', 'name code')
      .populate('section', 'name year')
      .populate('semester', 'name type')
      .populate({
        path    : 'faculty',
        select  : 'employeeId user',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .sort({ date: -1, periodNumber: 1 })
      .skip(skip)
      .limit(limit),
    Attendance.countDocuments(filter),
  ]);

  return { sessions, meta: buildPaginationMeta({ page, limit, total }) };
};

const getSessionById = async (id, caller) => {
  const sessionDoc = await Attendance.findById(id)
    .populate('course', 'name code')
    .populate('section', 'name year')
    .populate('semester', 'name type')
    .populate({
      path    : 'records.student',
      select  : 'rollNumber user',
      populate: { path: 'user', select: 'firstName lastName' },
    });

  if (!sessionDoc) throw new AppError('Attendance session not found', 404);

  if (caller.role === 'faculty' && String(sessionDoc.faculty) !== String(caller.facultyProfile)) {
    throw new AppError('You do not have permission to view another faculty member attendance session.', 403);
  }
  return sessionDoc;
};

const updateSession = async (id, payload, caller) => {
  return runInTransaction(async (dbSession) => {
    const att = await Attendance.findById(id).session(dbSession);
    if (!att) throw new AppError('Attendance session not found', 404);

    if (caller.role === 'faculty') {
      if (String(att.faculty) !== String(caller.facultyProfile)) {
        throw new AppError('You can only modify attendance sessions you created.', 403);
      }
      if (att.isFinalized) {
        throw new AppError('Attendance session is finalized. Submit an attendance correction request instead.', 403);
      }
      const policy = await getAttendancePolicy();
      const hoursElapsed = (Date.now() - att.createdAt.getTime()) / 3_600_000;
      if (hoursElapsed > policy.editWindowHours) {
        throw new AppError(`Edit window of ${policy.editWindowHours} hours has expired.`, 403);
      }
    }

    if (payload.topic !== undefined)   att.topic = payload.topic;
    if (payload.remarks !== undefined) att.remarks = payload.remarks;

    let affectedStudentIds = [];
    if (payload.records) {
      const seen = new Set();
      for (const r of payload.records) {
        if (seen.has(r.student)) {
          throw new AppError(`Duplicate student ${r.student} in update payload`, 400);
        }
        seen.add(r.student);
      }
      affectedStudentIds = Array.from(seen);

      const enrollments = await Enrollment.find({
        student : { $in: affectedStudentIds },
        course  : att.course,
        section : att.section,
        semester: att.semester,
        status  : { $in: ['enrolled', 'completed'] },
      }).select('_id student').session(dbSession);

      const enrollMap = new Map(enrollments.map((e) => [String(e.student), e._id]));
      const missing = affectedStudentIds.filter((sid) => !enrollMap.has(sid));
      if (missing.length > 0) {
        throw new AppError(`Students not enrolled in this class: ${missing.join(', ')}`, 400);
      }

      att.records = payload.records.map((r) => ({
        student   : r.student,
        enrollment: enrollMap.get(r.student),
        status    : r.status,
        remarks   : r.remarks,
        markedAt  : new Date(),
        markedBy  : caller.id,
      }));
    }

    await att.save({ session: dbSession });

    if (affectedStudentIds.length > 0) {
      await syncEnrollmentAttendance({
        studentIds: affectedStudentIds,
        courseId  : att.course,
        semesterId: att.semester,
        session   : dbSession,
      });
    }

    return att;
  });
};

const finalizeSession = async (id, caller) => {
  const att = await Attendance.findById(id);
  if (!att) throw new AppError('Attendance session not found', 404);

  if (caller.role === 'faculty' && String(att.faculty) !== String(caller.facultyProfile)) {
    throw new AppError('You can only finalize your own attendance sessions.', 403);
  }

  att.isFinalized = true;
  att.finalizedAt = new Date();
  att.finalizedBy = caller.id;
  await att.save();
  return att;
};

const getStudentSummary = async (studentId, query, caller) => {
  if (caller.role === 'student' && String(caller.studentProfile) !== String(studentId)) {
    throw new AppError('You can only view your own attendance summary.', 403);
  }

  const enrollFilter = { student: studentId, status: { $in: ['enrolled', 'completed'] } };
  if (query.semester)     enrollFilter.semester = query.semester;
  if (query.course)       enrollFilter.course = query.course;
  if (query.academicYear) enrollFilter.academicYear = query.academicYear;

  if (caller.role === 'faculty') {
    const assignments = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true })
      .select('course section semester');
    if (assignments.length === 0) throw new AppError('No assigned courses found', 403);
    enrollFilter.$or = assignments.map((a) => ({ course: a.course, section: a.section, semester: a.semester }));
  }

  const [enrollments, policy] = await Promise.all([
    Enrollment.find(enrollFilter)
      .populate('course', 'name code credits')
      .populate('semester', 'name type')
      .populate('section', 'name')
      .lean(),
    getAttendancePolicy(),
  ]);

  const attFilter = { 'records.student': studentId };
  if (query.semester)     attFilter.semester = query.semester;
  if (query.course)       attFilter.course = query.course;
  if (query.academicYear) attFilter.academicYear = query.academicYear;

  const sessions = await Attendance.find(attFilter)
    .select('course section semester date periodNumber sessionType topic records')
    .sort({ date: -1 })
    .lean();

  const courseBreakdown = enrollments.map((enroll) => {
    const courseSessions = sessions.filter(
      (s) => String(s.course) === String(enroll.course._id) && String(s.semester) === String(enroll.semester._id)
    );

    let totalClasses = 0;
    let present      = 0;
    let absent       = 0;
    let late         = 0;
    let excused      = 0;
    const history    = [];

    for (const sess of courseSessions) {
      const rec = sess.records.find((r) => String(r.student) === String(studentId));
      if (!rec) continue;
      history.push({
        sessionId   : sess._id,
        date        : sess.date,
        periodNumber: sess.periodNumber,
        sessionType : sess.sessionType,
        topic       : sess.topic,
        status      : rec.status,
        remarks     : rec.remarks,
      });
      if (rec.status === 'cancelled') continue;
      totalClasses += 1;
      if (rec.status === 'present') present += 1;
      if (rec.status === 'absent')  absent  += 1;
      if (rec.status === 'late')    late    += 1;
      if (rec.status === 'excused') excused += 1;
    }

    const attended   = present + excused + (policy.lateCountsAsPresent ? late : 0);
    const percentage = totalClasses > 0 ? Number(((attended / totalClasses) * 100).toFixed(2)) : 0;

    return {
      enrollmentId     : enroll._id,
      course           : enroll.course,
      section          : enroll.section,
      semester         : enroll.semester,
      totalClasses,
      present,
      absent,
      late,
      excused,
      attended,
      percentage,
      minimumRequired  : policy.minimumPercentage,
      meetsRequirement : totalClasses === 0 || percentage >= policy.minimumPercentage,
      history,
    };
  });

  return { policy, courses: courseBreakdown };
};

const getClassAttendanceReport = async (query, caller) => {
  if (caller.role === 'faculty') {
    await assertFacultyCourseAssignment({
      facultyProfileId: caller.facultyProfile,
      courseId        : query.course,
      sectionId       : query.section,
      semesterId      : query.semester,
    });
  }

  const [policy, enrollments, sessions] = await Promise.all([
    getAttendancePolicy(),
    Enrollment.find({
      course  : query.course,
      section : query.section,
      semester: query.semester,
      status  : { $in: ['enrolled', 'completed'] },
    }).populate({
      path    : 'student',
      select  : 'rollNumber user',
      populate: { path: 'user', select: 'firstName lastName email' },
    }).lean(),
    Attendance.find({
      course  : query.course,
      section : query.section,
      semester: query.semester,
    }).select('date records').lean(),
  ]);

  const studentStats = enrollments.map((enroll) => {
    let total   = 0;
    let present = 0;
    let absent  = 0;
    let late    = 0;
    let excused = 0;

    for (const s of sessions) {
      const rec = s.records.find((r) => String(r.student) === String(enroll.student._id));
      if (!rec || rec.status === 'cancelled') continue;
      total += 1;
      if (rec.status === 'present') present += 1;
      if (rec.status === 'absent')  absent  += 1;
      if (rec.status === 'late')    late    += 1;
      if (rec.status === 'excused') excused += 1;
    }

    const attended   = present + excused + (policy.lateCountsAsPresent ? late : 0);
    const percentage = total > 0 ? Number(((attended / total) * 100).toFixed(2)) : 0;

    return {
      student         : enroll.student,
      totalClasses    : total,
      present,
      absent,
      late,
      excused,
      percentage,
      meetsRequirement: total === 0 || percentage >= policy.minimumPercentage,
    };
  });

  return {
    totalSessions: sessions.length,
    policy,
    students     : studentStats,
    belowMinimum : studentStats.filter((s) => !s.meetsRequirement),
  };
};

// ── Attendance Correction Workflow ─────────────────────────────────────────
const createCorrectionRequest = async (payload, caller) => {
  const att = await Attendance.findById(payload.attendanceSession);
  if (!att) throw new AppError('Attendance session not found', 404);

  const studentId = caller.role === 'student' ? caller.studentProfile : payload.student;
  if (!studentId) throw new AppError('Student identifier is required', 400);

  if (caller.role === 'faculty') {
    await assertFacultyCourseAssignment({
      facultyProfileId: caller.facultyProfile,
      courseId        : att.course,
      sectionId       : att.section,
      semesterId      : att.semester,
    });
  }

  const record = att.records.find((r) => String(r.student) === String(studentId));
  if (!record) {
    throw new AppError('No attendance record exists for this student in the specified session', 404);
  }
  if (record.status === payload.requestedStatus) {
    throw new AppError('Requested attendance status is already the current status', 400);
  }

  const existingPending = await AttendanceCorrectionRequest.findOne({
    attendanceSession: att._id,
    student          : studentId,
    status           : 'pending',
  });
  if (existingPending) {
    throw new AppError('A pending attendance correction request already exists for this session', 409);
  }

  return AttendanceCorrectionRequest.create({
    attendanceSession    : att._id,
    student              : studentId,
    course               : att.course,
    section              : att.section,
    semester             : att.semester,
    requestedBy          : caller.id,
    requesterRole        : caller.role,
    currentStatus        : record.status,
    requestedStatus      : payload.requestedStatus,
    reason               : payload.reason,
    supportingDocumentUrl: payload.supportingDocumentUrl,
  });
};

const listCorrectionRequests = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)   filter.course = query.course;
  if (query.section)  filter.section = query.section;
  if (query.semester) filter.semester = query.semester;
  if (query.status)   filter.status = query.status;

  if (caller.role === 'student') {
    filter.student = caller.studentProfile;
  } else if (caller.role === 'faculty') {
    const assignments = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true })
      .select('course section semester');
    if (assignments.length === 0) {
      return { requests: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    filter.$or = assignments.map((a) => ({ course: a.course, section: a.section, semester: a.semester }));
  }

  const [requests, total] = await Promise.all([
    AttendanceCorrectionRequest.find(filter)
      .populate({
        path    : 'student',
        select  : 'rollNumber user',
        populate: { path: 'user', select: 'firstName lastName email' },
      })
      .populate('course', 'name code')
      .populate('section', 'name')
      .populate('attendanceSession', 'date periodNumber sessionType isFinalized')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    AttendanceCorrectionRequest.countDocuments(filter),
  ]);

  return { requests, meta: buildPaginationMeta({ page, limit, total }) };
};

const reviewCorrectionRequest = async (requestId, payload, caller) => {
  return runInTransaction(async (session) => {
    const reqDoc = await AttendanceCorrectionRequest.findById(requestId).session(session);
    if (!reqDoc) throw new AppError('Attendance correction request not found', 404);
    if (reqDoc.status !== 'pending') {
      throw new AppError(`Request has already been ${reqDoc.status}`, 400);
    }

    if (caller.role === 'faculty') {
      await assertFacultyCourseAssignment({
        facultyProfileId: caller.facultyProfile,
        courseId        : reqDoc.course,
        sectionId       : reqDoc.section,
        semesterId      : reqDoc.semester,
      });
    }

    if (payload.decision === 'approved') {
      const att = await Attendance.findById(reqDoc.attendanceSession).session(session);
      if (!att) throw new AppError('Referenced attendance session no longer exists', 404);

      const rec = att.records.find((r) => String(r.student) === String(reqDoc.student));
      if (!rec) throw new AppError('Student record missing from attendance session', 404);

      rec.status   = reqDoc.requestedStatus;
      rec.markedAt = new Date();
      rec.markedBy = caller.id;
      rec.remarks  = `Corrected via request ${reqDoc._id}`;
      await att.save({ session });

      await syncEnrollmentAttendance({
        studentIds: [String(reqDoc.student)],
        courseId  : reqDoc.course,
        semesterId: reqDoc.semester,
        session,
      });
    }

    reqDoc.status        = payload.decision;
    reqDoc.reviewedBy    = caller.id;
    reqDoc.reviewedAt    = new Date();
    reqDoc.reviewRemarks = payload.reviewRemarks;
    await reqDoc.save({ session });

    const student = await Student.findById(reqDoc.student).select('user').session(session);
    if (student?.user) {
      await Notification.create(
        [
          {
            recipient : student.user,
            type      : 'system',
            title     : `Attendance Correction ${payload.decision.toUpperCase()}`,
            message   : `Your attendance correction request was ${payload.decision}.`,
            entityType: 'AttendanceCorrectionRequest',
            entityId  : reqDoc._id,
            channels  : ['in_app'],
          },
        ],
        { session }
      );
    }

    return reqDoc;
  });
};

module.exports = {
  getPolicy,
  updatePolicy,
  createSession,
  listSessions,
  getSessionById,
  updateSession,
  finalizeSession,
  getStudentSummary,
  getClassAttendanceReport,
  createCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
  syncEnrollmentAttendance,
};

