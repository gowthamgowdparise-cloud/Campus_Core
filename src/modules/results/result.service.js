'use strict';

const Result           = require('./result.model');
const Student          = require('../students/student.model');
const Enrollment       = require('../enrollments/enrollment.model');
const Marks            = require('../marks/marks.model');
const Examination      = require('../examinations/examination.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const Notification     = require('../notifications/notification.model');
const { getGradingPolicy } = require('../system/systemSettings.helper');
const AppError         = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }     = require('../../utils/queryHelpers');

const resolveGradeFromScale = (percentage, scale) => {
  const sorted = [...scale].sort((a, b) => b.minPercentage - a.minPercentage);
  for (const band of sorted) {
    if (percentage >= band.minPercentage) return band;
  }
  return sorted[sorted.length - 1] || { grade: 'F', gradePoint: 0, isPass: false };
};

const populateResult = (query) =>
  query
    .populate({
      path    : 'student',
      select  : 'rollNumber enrollmentNumber currentSemester cgpa user department program',
      populate: { path: 'user', select: 'firstName lastName email' },
    })
    .populate('semester', 'name type semesterNumber')
    .populate('academicYear', 'name')
    .populate('examination', 'name type')
    .populate('courseResults.course', 'name code credits type totalMarks passingMarks');

const listResults = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.semester)     filter.semester = query.semester;
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.examination)  filter.examination = query.examination;
  if (query.resultStatus) filter.resultStatus = query.resultStatus;

  if (caller.role === 'student') {
    if (!caller.studentProfile) throw new AppError('Student profile not linked', 403);
    filter.student     = caller.studentProfile;
    filter.isPublished = true;
  } else {
    if (query.student)                    filter.student = query.student;
    if (query.isPublished !== undefined) filter.isPublished = query.isPublished;
  }

  const [results, total] = await Promise.all([
    populateResult(Result.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Result.countDocuments(filter),
  ]);

  return { results, meta: buildPaginationMeta({ page, limit, total }) };
};

const getStudentResults = async (studentId, caller) => {
  if (caller.role === 'student' && String(caller.studentProfile) !== String(studentId)) {
    throw new AppError('You can only view your own examination results.', 403);
  }
  const filter = { student: studentId };
  if (caller.role === 'student') filter.isPublished = true;

  return populateResult(Result.find(filter)).sort({ createdAt: 1 });
};

const getBacklogs = async (studentId, caller) => {
  if (caller.role === 'student' && String(caller.studentProfile) !== String(studentId)) {
    throw new AppError('You can only view your own backlog records.', 403);
  }

  const filter = { 'courseResults.isBacklog': true };
  if (studentId) filter.student = studentId;
  if (caller.role === 'student') filter.isPublished = true;

  const results = await Result.find(filter)
    .populate('student', 'rollNumber enrollmentNumber')
    .populate('semester', 'name type')
    .populate('academicYear', 'name')
    .populate('courseResults.course', 'name code credits')
    .lean();

  const backlogs = [];
  for (const resDoc of results) {
    for (const cr of resDoc.courseResults) {
      if (cr.isBacklog || cr.status === 'fail' || cr.status === 'absent') {
        backlogs.push({
          resultId    : resDoc._id,
          student     : resDoc.student,
          semester    : resDoc.semester,
          academicYear: resDoc.academicYear,
          course      : cr.course,
          percentage  : cr.percentage,
          grade       : cr.grade,
          status      : cr.status,
          attempts    : cr.attempts,
          isPublished : resDoc.isPublished,
        });
      }
    }
  }
  return backlogs;
};

/**
 * Generate or recalculate a student's semester Result from verified Marks using
 * configurable SystemSetting grading rules inside an atomic MongoDB transaction.
 */
const generateResult = async ({ student, semester, academicYear, examination, remarks }, _caller) => {
  const gradingPolicy = await getGradingPolicy();

  return runInTransaction(async (session) => {
    const studentDoc  = await Student.findById(student).session(session);
    const enrollments = await Enrollment.find({
      student,
      semester,
      status: { $in: ['enrolled', 'completed', 'failed'] },
    })
      .populate('course', 'name code credits totalMarks passingMarks')
      .session(session);

    if (!studentDoc) throw new AppError('Student record not found', 404);
    if (enrollments.length === 0) {
      throw new AppError('No active course enrollments found for this student and semester', 400);
    }

    if (examination) {
      const examDoc = await Examination.findById(examination).session(session);
      if (!examDoc) throw new AppError('Examination not found', 404);
    }

    const existingResult = await Result.findOne({ student, semester }).session(session);
    if (existingResult && existingResult.isPublished && (!examination)) {
      throw new AppError('Result for this semester is already published and locked. Specify a supplementary/improvement examination to re-process.', 409);
    }

    const courseIds = enrollments.map((e) => e.course._id);
    const verifiedMarks = await Marks.find({
      student,
      semester,
      course    : { $in: courseIds },
      isVerified: true,
    }).session(session);

    // Also fetch any prior results for attempt tracking on backlogs
    const priorResults = await Result.find({
      student,
      semester: { $ne: semester },
    }).select('courseResults').session(session);

    const courseResults = [];
    let totalCreditsRegistered = 0;
    let totalCreditsEarned     = 0;
    let totalCreditPoints      = 0;
    let activeBacklogs         = 0;
    let anyWithheld            = false;

    for (const enroll of enrollments) {
      const course = enroll.course;
      const courseMarks = verifiedMarks.filter((m) => String(m.course) === String(course._id));
      if (courseMarks.length === 0) {
        throw new AppError(`Cannot generate result: no verified/approved marks exist for course ${course.code}`, 400);
      }

      let internalMarks = 0;
      let externalMarks = 0;
      let maxMarksSum   = 0;
      let anyAbsent     = false;
      let markWithheld  = false;

      // If a 'total' entry exists, use it directly; otherwise sum components
      const totalEntry = courseMarks.find((m) => m.marksType === 'total');
      if (totalEntry) {
        externalMarks = totalEntry.effectiveMarks ?? totalEntry.obtainedMarks;
        maxMarksSum   = totalEntry.maxMarks;
        anyAbsent     = totalEntry.isAbsent;
        markWithheld  = totalEntry.isWithheld;
      } else {
        for (const m of courseMarks) {
          const val = m.effectiveMarks ?? m.obtainedMarks ?? 0;
          if (m.marksType === 'internal') {
            internalMarks += val;
          } else {
            externalMarks += val;
          }
          maxMarksSum += m.maxMarks || 0;
          if (m.isAbsent)   anyAbsent = true;
          if (m.isWithheld) markWithheld = true;
        }
      }

      if (markWithheld) anyWithheld = true;

      const totalObtained = Math.min(maxMarksSum || course.totalMarks || 100, internalMarks + externalMarks);
      const effectiveMax  = maxMarksSum || course.totalMarks || 100;
      const percentage    = effectiveMax > 0 ? Number(((totalObtained / effectiveMax) * 100).toFixed(2)) : 0;

      const band = resolveGradeFromScale(percentage, gradingPolicy.scale);
      const coursePassPct = course.totalMarks > 0
        ? (course.passingMarks / course.totalMarks) * 100
        : gradingPolicy.passingPercentage;

      let status = 'pass';
      if (markWithheld) {
        status = 'withheld';
      } else if (anyAbsent) {
        status = 'absent';
      } else if (!band.isPass || percentage < Math.max(coursePassPct, gradingPolicy.passingPercentage)) {
        status = 'fail';
      }

      const isPass       = status === 'pass';
      const gradePoint   = isPass ? band.gradePoint : 0;
      const grade        = isPass ? band.grade : (status === 'absent' ? 'AB' : (status === 'withheld' ? 'WH' : 'F'));
      const credits      = course.credits || 0;
      const creditPoints = Number((gradePoint * credits).toFixed(2));

      totalCreditsRegistered += credits;
      if (isPass) totalCreditsEarned += credits;
      else activeBacklogs += 1;
      totalCreditPoints += creditPoints;

      let priorAttempts = 0;
      for (const pr of priorResults) {
        if (pr.courseResults.some((cr) => String(cr.course) === String(course._id))) {
          priorAttempts += 1;
        }
      }

      courseResults.push({
        course       : course._id,
        enrollment   : enroll._id,
        internalMarks,
        externalMarks,
        totalMarks   : totalObtained,
        maxMarks     : effectiveMax,
        percentage,
        gradePoint,
        grade,
        credits,
        creditPoints,
        status,
        isBacklog    : status === 'fail' || status === 'absent',
        attempts     : priorAttempts + 1,
      });

      enroll.status = isPass ? 'completed' : 'failed';
      await enroll.save({ session });
    }

    const sgpa = totalCreditsRegistered > 0
      ? Number((totalCreditPoints / totalCreditsRegistered).toFixed(2))
      : 0;

    // Cumulative CGPA across all semester results for this student
    const otherResults = await Result.find({ student, semester: { $ne: semester } }).session(session);
    let cumCreditPoints = totalCreditPoints;
    let cumCreditsReg   = totalCreditsRegistered;
    let totalBacklogs   = activeBacklogs;

    for (const r of otherResults) {
      cumCreditPoints += r.totalCreditPoints || 0;
      cumCreditsReg   += r.totalCreditsRegistered || 0;
      totalBacklogs   += r.activeBacklogs || 0;
    }

    const cgpa = cumCreditsReg > 0 ? Number((cumCreditPoints / cumCreditsReg).toFixed(2)) : 0;

    let resultStatus = 'pass';
    if (anyWithheld)        resultStatus = 'withheld';
    else if (activeBacklogs > 0) resultStatus = 'fail';

    const resultPayload = {
      student,
      semester,
      academicYear,
      examination: examination || null,
      courseResults,
      totalCreditsRegistered,
      totalCreditsEarned,
      totalCreditPoints,
      sgpa,
      cgpa,
      totalBacklogs,
      activeBacklogs,
      resultStatus,
      isPublished: false,
      remarks,
    };

    let savedResult;
    if (existingResult) {
      Object.assign(existingResult, resultPayload);
      savedResult = await existingResult.save({ session });
    } else {
      const [created] = await Result.create([resultPayload], { session });
      savedResult = created;
    }

    return populateResult(Result.findById(savedResult._id).session(session));
  });
};

const publishResult = async (resultId, callerId) => {
  return runInTransaction(async (session) => {
    const result = await Result.findById(resultId).session(session);
    if (!result) throw new AppError('Result not found', 404);
    if (result.isPublished) throw new AppError('Result is already published', 400);
    if (!result.courseResults || result.courseResults.length === 0) {
      throw new AppError('Cannot publish an empty result without course evaluations', 400);
    }

    result.isPublished = true;
    result.publishedAt = new Date();
    result.publishedBy = callerId;
    await result.save({ session });

    // Recompute Student cumulative CGPA & totalCreditsEarned across published results
    const publishedResults = await Result.find({
      student    : result.student,
      isPublished: true,
    }).session(session);

    let cumPoints  = 0;
    let cumReg     = 0;
    let cumEarned  = 0;
    for (const pr of publishedResults) {
      cumPoints += pr.totalCreditPoints || 0;
      cumReg    += pr.totalCreditsRegistered || 0;
      cumEarned += pr.totalCreditsEarned || 0;
    }
    const finalCgpa = cumReg > 0 ? Number((cumPoints / cumReg).toFixed(2)) : 0;

    const student = await Student.findByIdAndUpdate(
      result.student,
      { $set: { cgpa: finalCgpa, totalCreditsEarned: cumEarned } },
      { new: true, session }
    );

    if (student?.user) {
      await Notification.create(
        [
          {
            recipient : student.user,
            type      : 'result_published',
            title     : 'Semester Result Published',
            message   : `Your semester result has been published (SGPA: ${result.sgpa}, CGPA: ${finalCgpa}).`,
            entityType: 'Result',
            entityId  : result._id,
            channels  : ['in_app'],
          },
        ],
        { session }
      );
    }

    return populateResult(Result.findById(result._id).session(session));
  });
};

const getClassPerformanceReport = async ({ course, semester, section }, caller) => {
  if (caller.role === 'faculty') {
    const query = { faculty: caller.facultyProfile, course, semester, isActive: true };
    if (section) query.section = section;
    const assigned = await CourseAssignment.exists(query);
    if (!assigned) {
      throw new AppError('You can only view performance reports for courses assigned to you.', 403);
    }
  }

  const enrollFilter = { course, semester, status: { $in: ['enrolled', 'completed', 'failed'] } };
  if (section) enrollFilter.section = section;
  const studentIds = await Enrollment.find(enrollFilter).distinct('student');

  const [results, marks] = await Promise.all([
    Result.find({ semester, student: { $in: studentIds }, 'courseResults.course': course })
      .select('student courseResults isPublished'),
    Marks.find({ course, semester, student: { $in: studentIds } })
      .select('student marksType maxMarks obtainedMarks effectiveMarks isAbsent'),
  ]);

  const percentages = [];
  const gradeCounts = {};
  let passCount = 0;
  let failCount = 0;

  for (const r of results) {
    const cr = r.courseResults.find((item) => String(item.course) === String(course));
    if (!cr) continue;
    percentages.push(cr.percentage);
    gradeCounts[cr.grade || 'NA'] = (gradeCounts[cr.grade || 'NA'] || 0) + 1;
    if (cr.status === 'pass') passCount += 1;
    else failCount += 1;
  }

  const evaluated = percentages.length;
  const avgPercentage = evaluated > 0
    ? Number((percentages.reduce((a, b) => a + b, 0) / evaluated).toFixed(2))
    : 0;

  return {
    course,
    semester,
    section          : section || null,
    enrolledStudents : studentIds.length,
    evaluatedResults : evaluated,
    passCount,
    failCount,
    passPercentage   : evaluated > 0 ? Number(((passCount / evaluated) * 100).toFixed(2)) : 0,
    averagePercentage: avgPercentage,
    highestPercentage: evaluated > 0 ? Math.max(...percentages) : 0,
    lowestPercentage : evaluated > 0 ? Math.min(...percentages) : 0,
    gradeDistribution: gradeCounts,
    totalMarkRecords : marks.length,
  };
};

module.exports = {
  resolveGradeFromScale,
  listResults,
  getStudentResults,
  getBacklogs,
  generateResult,
  publishResult,
  getClassPerformanceReport,
};

