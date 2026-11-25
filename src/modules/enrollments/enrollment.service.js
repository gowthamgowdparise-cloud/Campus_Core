'use strict';

const Enrollment       = require('./enrollment.model');
const Student          = require('../students/student.model');
const Course           = require('../courses/course.model');
const Section          = require('../sections/section.model');
const Semester         = require('../semesters/semester.model');
const AcademicYear     = require('../academic-years/academicYear.model');
const Program          = require('../programs/program.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const { getSettingValue } = require('../system/systemSettings.helper');
const AppError         = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }     = require('../../utils/queryHelpers');

const populateEnrollment = (query) =>
  query
    .populate({
      path    : 'student',
      select  : 'rollNumber enrollmentNumber currentSemester user',
      populate: { path: 'user', select: 'firstName lastName email' },
    })
    .populate('course', 'name code credits type semesterNumber')
    .populate('section', 'name year semesterNumber')
    .populate('semester', 'name type isCurrent')
    .populate('academicYear', 'name isCurrent')
    .populate({
      path    : 'faculty',
      select  : 'employeeId user',
      populate: { path: 'user', select: 'firstName lastName' },
    });

const listEnrollments = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)       filter.course = query.course;
  if (query.section)      filter.section = query.section;
  if (query.semester)     filter.semester = query.semester;
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.status)       filter.status = query.status;

  if (caller.role === 'student') {
    if (!caller.studentProfile) throw new AppError('Student profile not linked', 403);
    filter.student = caller.studentProfile;
  } else if (caller.role === 'faculty') {
    const assignments = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true })
      .select('course section semester');
    if (assignments.length === 0) {
      return { enrollments: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    filter.$or = assignments.map((a) => ({ course: a.course, section: a.section, semester: a.semester }));
  } else if (query.student) {
    filter.student = query.student;
  }

  const [enrollments, total] = await Promise.all([
    populateEnrollment(Enrollment.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Enrollment.countDocuments(filter),
  ]);

  return { enrollments, meta: buildPaginationMeta({ page, limit, total }) };
};

const validateEligibilityAndEnroll = async ({
  studentId,
  courseId,
  sectionId,
  semesterId,
  academicYearId,
  facultyId = null,
  defaultMaxCreditsOverride = null,
  session,
}) => {
  const defaultMaxCredits = defaultMaxCreditsOverride !== null
    ? defaultMaxCreditsOverride
    : await getSettingValue('enrollment.defaultMaxCredits', 30);

  const student      = await Student.findById(studentId).session(session);
  const course       = await Course.findById(courseId).session(session);
  const section      = await Section.findById(sectionId).session(session);
  const semester     = await Semester.findById(semesterId).session(session);
  const academicYear = await AcademicYear.findById(academicYearId).session(session);

  if (!student || student.status !== 'active') throw new AppError('Active student record is required for enrollment', 400);
  if (!course  || !course.isActive)            throw new AppError('Active course is required for enrollment', 404);
  if (!section || !section.isActive)           throw new AppError('Active section is required for enrollment', 404);
  if (!semester)                               throw new AppError('Semester not found', 404);
  if (!academicYear)                           throw new AppError('Academic year not found', 404);

  if (String(section.semester) !== String(semester._id) || String(section.academicYear) !== String(academicYear._id)) {
    throw new AppError('Section does not belong to the specified semester and academic year', 400);
  }
  if (course.category !== 'open_elective' && String(course.program) !== String(student.program)) {
    throw new AppError('Course does not belong to the student program', 400);
  }
  if (String(section.program) !== String(student.program)) {
    throw new AppError('Section does not belong to the student program', 400);
  }

  // Prevent duplicate enrollment
  const existing = await Enrollment.findOne({
    student : student._id,
    course  : course._id,
    semester: semester._id,
  }).session(session);
  if (existing && existing.status !== 'dropped') {
    throw new AppError('Student is already enrolled in this course for the specified semester', 409);
  }

  // Check prerequisites completed
  if (course.prerequisites && course.prerequisites.length > 0) {
    const completedCount = await Enrollment.countDocuments({
      student: student._id,
      course : { $in: course.prerequisites },
      status : 'completed',
    }).session(session);
    if (completedCount < course.prerequisites.length) {
      throw new AppError('Student has not completed all prerequisite courses', 400);
    }
  }

  // Check semester max credit limit (Program.semesterConfig -> SystemSetting fallback)
  const program = await Program.findById(student.program).session(session);
  const currentEnrollments = await Enrollment.find({ student: student._id, semester: semester._id, status: 'enrolled' })
    .populate('course', 'credits')
    .session(session);

  const semCfg = program?.semesterConfig?.find((c) => c.semesterNumber === course.semesterNumber);
  const maxCredits = semCfg ? semCfg.maxCredits : Number(defaultMaxCredits || 30);
  const currentCredits = currentEnrollments.reduce((sum, e) => sum + (e.course?.credits || 0), 0);

  if (currentCredits + course.credits > maxCredits) {
    throw new AppError(`Credit limit exceeded: enrolling would total ${currentCredits + course.credits} credits (max ${maxCredits}).`, 400);
  }

  // Resolve assigned primary faculty if not provided
  let resolvedFaculty = facultyId;
  if (!resolvedFaculty) {
    const assignment = await CourseAssignment.findOne({
      course  : course._id,
      section : section._id,
      semester: semester._id,
      isActive: true,
    }).sort({ role: 1 }).session(session);
    resolvedFaculty = assignment?.faculty || null;
  }

  if (existing && existing.status === 'dropped') {
    existing.status     = 'enrolled';
    existing.section    = section._id;
    existing.faculty    = resolvedFaculty;
    existing.enrolledAt = new Date();
    existing.droppedAt  = undefined;
    existing.dropReason = undefined;
    await existing.save({ session });
    return existing;
  }

  const [enrollment] = await Enrollment.create(
    [
      {
        student     : student._id,
        course      : course._id,
        section     : section._id,
        semester    : semester._id,
        academicYear: academicYear._id,
        faculty     : resolvedFaculty,
      },
    ],
    { session }
  );

  return enrollment;
};

const createEnrollment = async (payload, caller) => {
  // Never trust student ID in body when caller is a student
  const studentId = caller.role === 'student' ? caller.studentProfile : payload.student;
  if (!studentId) throw new AppError('Student identifier is required', 400);

  return runInTransaction(async (session) => {
    const enrollment = await validateEligibilityAndEnroll({
      studentId,
      courseId      : payload.course,
      sectionId     : payload.section,
      semesterId    : payload.semester,
      academicYearId: payload.academicYear,
      facultyId     : caller.role === 'admin' ? payload.faculty : null,
      session,
    });
    return populateEnrollment(Enrollment.findById(enrollment._id).session(session));
  });
};

const bulkEnroll = async (payload) => {
  const defaultMaxCredits = await getSettingValue('enrollment.defaultMaxCredits', 30);
  return runInTransaction(async (session) => {
    const created = [];
    for (const studentId of payload.studentIds) {
      const enrollment = await validateEligibilityAndEnroll({
        studentId,
        courseId      : payload.course,
        sectionId     : payload.section,
        semesterId    : payload.semester,
        academicYearId: payload.academicYear,
        defaultMaxCreditsOverride: defaultMaxCredits,
        session,
      });
      created.push(enrollment);
    }
    return created;
  });
};

const dropEnrollment = async (id, reason, caller) => {
  const enrollment = await Enrollment.findById(id);
  if (!enrollment) throw new AppError('Enrollment record not found', 404);

  if (caller.role === 'student' && String(enrollment.student) !== String(caller.studentProfile)) {
    throw new AppError('You can only drop your own course enrollments.', 403);
  }
  if (enrollment.status !== 'enrolled') {
    throw new AppError(`Cannot drop enrollment with status "${enrollment.status}"`, 400);
  }

  enrollment.status     = 'dropped';
  enrollment.droppedAt  = new Date();
  enrollment.dropReason = reason || 'Dropped';
  await enrollment.save();
  return enrollment;
};

const updateEnrollmentStatus = async (id, payload) => {
  const enrollment = await Enrollment.findById(id);
  if (!enrollment) throw new AppError('Enrollment record not found', 404);

  enrollment.status = payload.status;
  if (payload.isEligibleForExam !== undefined)  enrollment.isEligibleForExam = payload.isEligibleForExam;
  if (payload.ineligibilityReason !== undefined) enrollment.ineligibilityReason = payload.ineligibilityReason;
  await enrollment.save();
  return enrollment;
};

module.exports = {
  listEnrollments,
  createEnrollment,
  bulkEnroll,
  dropEnrollment,
  updateEnrollmentStatus,
};

