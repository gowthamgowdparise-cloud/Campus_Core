'use strict';

const Marks                  = require('./marks.model');
const MarksCorrectionRequest = require('./marksCorrection.model');
const Enrollment             = require('../enrollments/enrollment.model');
const Assessment             = require('../assessments/assessment.model');
const Examination            = require('../examinations/examination.model');
const CourseAssignment       = require('../courses/courseAssignment.model');
const Notification           = require('../notifications/notification.model');
const Student                = require('../students/student.model');
const { getGradingPolicy }   = require('../system/systemSettings.helper');
const AppError               = require('../../utils/AppError');
const { runInTransaction }   = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }    = require('../../utils/queryHelpers');

const populateMarks = (query) =>
  query
    .populate({
      path    : 'student',
      select  : 'rollNumber enrollmentNumber user',
      populate: { path: 'user', select: 'firstName lastName email' },
    })
    .populate('course', 'name code credits totalMarks passingMarks')
    .populate('semester', 'name type')
    .populate('assessment', 'title type maxMarks')
    .populate('examination', 'name type');

const assertFacultyMarksAccess = async ({ facultyProfileId, courseId, sectionId, semesterId }) => {
  if (!facultyProfileId) throw new AppError('Faculty profile is required', 403);
  const assigned = await CourseAssignment.exists({
    faculty : facultyProfileId,
    course  : courseId,
    section : sectionId,
    semester: semesterId,
    isActive: true,
  });
  if (!assigned) {
    throw new AppError('You are not assigned to enter or manage marks for this student course/section.', 403);
  }
};

const listMarks = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)           filter.course = query.course;
  if (query.semester)         filter.semester = query.semester;
  if (query.assessment)       filter.assessment = query.assessment;
  if (query.examination)      filter.examination = query.examination;
  if (query.marksType)        filter.marksType = query.marksType;
  if (query.submissionStatus) filter.submissionStatus = query.submissionStatus;
  if (query.isVerified !== undefined) filter.isVerified = query.isVerified;

  if (caller.role === 'student') {
    if (!caller.studentProfile) throw new AppError('Student profile not linked', 403);
    filter.student = caller.studentProfile;
  } else if (caller.role === 'faculty') {
    const assignments = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true })
      .select('course section semester');
    if (assignments.length === 0) {
      return { marks: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    const enrollments = await Enrollment.find({
      $or: assignments.map((a) => ({ course: a.course, section: a.section, semester: a.semester })),
    }).distinct('_id');
    filter.enrollment = { $in: enrollments };
  } else if (query.student) {
    filter.student = query.student;
  }

  const [marks, total] = await Promise.all([
    populateMarks(Marks.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Marks.countDocuments(filter),
  ]);

  return { marks, meta: buildPaginationMeta({ page, limit, total }) };
};

const upsertSingleMark = async (entry, caller, session = null, preloaded = {}) => {
  const gradingPolicy = preloaded.gradingPolicy || await getGradingPolicy();
  const enrollment = await Enrollment.findOne({
    student : entry.student,
    course  : entry.course,
    semester: entry.semester,
    status  : { $in: ['enrolled', 'completed', 'failed'] },
  }).session(session);

  if (!enrollment) {
    throw new AppError(`Student ${entry.student} is not enrolled in course ${entry.course} for the specified semester.`, 400);
  }

  if (caller.role === 'faculty') {
    await assertFacultyMarksAccess({
      facultyProfileId: caller.facultyProfile,
      courseId        : entry.course,
      sectionId       : enrollment.section,
      semesterId      : entry.semester,
    });
  }

  if (entry.assessment) {
    const assess = await Assessment.findById(entry.assessment).session(session);
    if (!assess) throw new AppError('Assessment not found', 404);
    if (String(assess.course) !== String(entry.course)) {
      throw new AppError('Assessment does not belong to the specified course', 400);
    }
  }

  if (entry.examination) {
    const exam = await Examination.findById(entry.examination).session(session);
    if (!exam) throw new AppError('Examination not found', 404);
  }

  if (!entry.isAbsent && entry.obtainedMarks > entry.maxMarks) {
    throw new AppError(`obtainedMarks (${entry.obtainedMarks}) cannot exceed maxMarks (${entry.maxMarks})`, 400);
  }

  if ((entry.graceMarks || 0) > gradingPolicy.maxGraceMarks) {
    throw new AppError(`graceMarks (${entry.graceMarks}) exceed configured institutional limit (${gradingPolicy.maxGraceMarks})`, 400);
  }

  const existing = await Marks.findOne({
    student    : entry.student,
    course     : entry.course,
    semester   : entry.semester,
    marksType  : entry.marksType,
    assessment : entry.assessment || null,
    examination: entry.examination || null,
  }).session(session);

  if (existing) {
    if (caller.role !== 'admin' && (existing.isVerified || existing.submissionStatus === 'approved')) {
      throw new AppError('Approved marks cannot be modified directly. Submit a marks correction request.', 403);
    }
    existing.maxMarks      = entry.maxMarks;
    existing.obtainedMarks = entry.obtainedMarks;
    existing.graceMarks    = entry.graceMarks || 0;
    existing.isAbsent      = Boolean(entry.isAbsent);
    existing.isWithheld    = Boolean(entry.isWithheld);
    existing.remarks       = entry.remarks;
    existing.enteredBy     = caller.id;
    await existing.save({ session });
    return existing;
  }

  const [created] = await Marks.create(
    [
      {
        student     : entry.student,
        enrollment  : enrollment._id,
        course      : entry.course,
        semester    : entry.semester,
        academicYear: entry.academicYear,
        assessment  : entry.assessment || null,
        examination : entry.examination || null,
        marksType   : entry.marksType,
        maxMarks    : entry.maxMarks,
        obtainedMarks: entry.obtainedMarks,
        graceMarks  : entry.graceMarks || 0,
        isAbsent    : Boolean(entry.isAbsent),
        isWithheld  : Boolean(entry.isWithheld),
        enteredBy   : caller.id,
        remarks     : entry.remarks,
      },
    ],
    { session }
  );

  return created;
};

const enterMarks = async (entry, caller) => runInTransaction((session) => upsertSingleMark(entry, caller, session));

const enterBulkMarks = async (entries, caller) => {
  const gradingPolicy = await getGradingPolicy();
  return runInTransaction(async (session) => {
    const results = [];
    for (const entry of entries) {
      const saved = await upsertSingleMark(entry, caller, session, { gradingPolicy });
      results.push(saved);
    }
    return results;
  });
};

const updateMarks = async (id, payload, caller) => {
  const mark = await Marks.findById(id).populate('enrollment', 'section');
  if (!mark) throw new AppError('Marks record not found', 404);

  if (caller.role === 'faculty') {
    await assertFacultyMarksAccess({
      facultyProfileId: caller.facultyProfile,
      courseId        : mark.course,
      sectionId       : mark.enrollment?.section,
      semesterId      : mark.semester,
    });
    if (mark.isVerified || mark.submissionStatus === 'approved') {
      throw new AppError('Approved marks cannot be modified directly. Submit a marks correction request.', 403);
    }
  }

  if (payload.graceMarks !== undefined) {
    const policy = await getGradingPolicy();
    if (payload.graceMarks > policy.maxGraceMarks) {
      throw new AppError(`graceMarks exceed configured maximum (${policy.maxGraceMarks})`, 400);
    }
  }

  Object.assign(mark, payload);
  await mark.save();
  return mark;
};

const submitMarks = async (markIds, caller) => {
  const facultyAssignmentKeys = caller.role === 'faculty'
    ? new Set(
        (await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true })
          .select('course section semester')
          .lean()).map((a) => `${a.course}:${a.section}:${a.semester}`)
      )
    : null;

  return runInTransaction(async (session) => {
    const marksList = await Marks.find({ _id: { $in: markIds } })
      .populate('enrollment', 'section')
      .session(session);
    if (marksList.length !== markIds.length) {
      throw new AppError('One or more marks records were not found', 404);
    }

    for (const mark of marksList) {
      if (caller.role === 'faculty') {
        const key = `${mark.course}:${mark.enrollment?.section}:${mark.semester}`;
        if (!facultyAssignmentKeys.has(key)) {
          throw new AppError('You are not assigned to enter or manage marks for this student course/section.', 403);
        }
      }
      if (mark.isVerified) {
        throw new AppError(`Marks record ${mark._id} is already approved`, 400);
      }
      mark.submissionStatus = 'submitted';
      mark.submittedBy      = caller.id;
      mark.submittedAt      = new Date();
      await mark.save({ session });
    }
    return marksList;
  });
};

const reviewMarksApproval = async (markIds, { decision, rejectionReason }, callerId) => {
  return runInTransaction(async (session) => {
    const marksList = await Marks.find({ _id: { $in: markIds } }).session(session);
    if (marksList.length !== markIds.length) {
      throw new AppError('One or more marks records were not found', 404);
    }

    for (const mark of marksList) {
      if (decision === 'approved') {
        mark.submissionStatus = 'approved';
        mark.isVerified       = true;
        mark.verifiedBy       = callerId;
        mark.verifiedAt       = new Date();
        mark.rejectionReason  = undefined;
      } else {
        mark.submissionStatus = 'rejected';
        mark.isVerified       = false;
        mark.verifiedBy       = callerId;
        mark.verifiedAt       = new Date();
        mark.rejectionReason  = rejectionReason;
      }
      await mark.save({ session });
    }
    return marksList;
  });
};

// ── Marks Correction Workflow ──────────────────────────────────────────────
const createCorrectionRequest = async (payload, caller) => {
  const mark = await Marks.findById(payload.marksRecord).populate('enrollment', 'section');
  if (!mark) throw new AppError('Marks record not found', 404);

  if (caller.role === 'student' && String(mark.student) !== String(caller.studentProfile)) {
    throw new AppError('You can only submit marks correction requests for your own marks.', 403);
  }
  if (caller.role === 'faculty') {
    await assertFacultyMarksAccess({
      facultyProfileId: caller.facultyProfile,
      courseId        : mark.course,
      sectionId       : mark.enrollment?.section,
      semesterId      : mark.semester,
    });
  }

  if (payload.requestedMarks !== null && payload.requestedMarks !== undefined && payload.requestedMarks > mark.maxMarks) {
    throw new AppError(`requestedMarks (${payload.requestedMarks}) cannot exceed maxMarks (${mark.maxMarks})`, 400);
  }

  const existingPending = await MarksCorrectionRequest.findOne({
    marksRecord: mark._id,
    status     : 'pending',
  });
  if (existingPending) {
    throw new AppError('A pending correction request already exists for this marks record.', 409);
  }

  return MarksCorrectionRequest.create({
    marksRecord   : mark._id,
    student       : mark.student,
    course        : mark.course,
    semester      : mark.semester,
    requestedBy   : caller.id,
    requesterRole : caller.role,
    currentMarks  : mark.obtainedMarks,
    requestedMarks: payload.requestedMarks ?? null,
    reason        : payload.reason,
  });
};

const listCorrectionRequests = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)   filter.course = query.course;
  if (query.semester) filter.semester = query.semester;
  if (query.status)   filter.status = query.status;

  if (caller.role === 'student') {
    filter.student = caller.studentProfile;
  } else if (caller.role === 'faculty') {
    const assignments = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true })
      .select('course semester');
    if (assignments.length === 0) {
      return { requests: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    filter.$or = assignments.map((a) => ({ course: a.course, semester: a.semester }));
  }

  const [requests, total] = await Promise.all([
    MarksCorrectionRequest.find(filter)
      .populate({
        path    : 'student',
        select  : 'rollNumber user',
        populate: { path: 'user', select: 'firstName lastName email' },
      })
      .populate('course', 'name code')
      .populate('marksRecord', 'marksType maxMarks obtainedMarks effectiveMarks isVerified submissionStatus')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    MarksCorrectionRequest.countDocuments(filter),
  ]);

  return { requests, meta: buildPaginationMeta({ page, limit, total }) };
};

const reviewCorrectionRequest = async (requestId, payload, caller) => {
  return runInTransaction(async (session) => {
    const reqDoc = await MarksCorrectionRequest.findById(requestId).session(session);
    if (!reqDoc) throw new AppError('Marks correction request not found', 404);
    if (reqDoc.status !== 'pending') {
      throw new AppError(`Correction request has already been ${reqDoc.status}`, 400);
    }

    const mark = await Marks.findById(reqDoc.marksRecord)
      .populate('enrollment', 'section')
      .session(session);
    if (!mark) throw new AppError('Referenced marks record not found', 404);

    if (caller.role === 'faculty') {
      await assertFacultyMarksAccess({
        facultyProfileId: caller.facultyProfile,
        courseId        : mark.course,
        sectionId       : mark.enrollment?.section,
        semesterId      : mark.semester,
      });
      if (mark.isVerified) {
        throw new AppError('Verified/approved marks corrections require administrator approval.', 403);
      }
    }

    if (payload.decision === 'approved') {
      const nextMarks = payload.updatedMarks ?? reqDoc.requestedMarks;
      if (nextMarks === null || nextMarks === undefined) {
        throw new AppError('updatedMarks must be provided when approving a correction request', 400);
      }
      if (nextMarks > mark.maxMarks) {
        throw new AppError(`updatedMarks (${nextMarks}) cannot exceed maxMarks (${mark.maxMarks})`, 400);
      }

      mark.obtainedMarks = nextMarks;
      mark.isAbsent      = false;
      mark.remarks       = `Updated via correction request ${reqDoc._id}`;
      await mark.save({ session });
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
            title     : `Marks Correction ${payload.decision.toUpperCase()}`,
            message   : `Your marks correction request was ${payload.decision}.`,
            entityType: 'MarksCorrectionRequest',
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
  listMarks,
  enterMarks,
  enterBulkMarks,
  updateMarks,
  submitMarks,
  reviewMarksApproval,
  createCorrectionRequest,
  listCorrectionRequests,
  reviewCorrectionRequest,
};

