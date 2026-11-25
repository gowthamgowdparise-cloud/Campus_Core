'use strict';

const Assessment       = require('./assessment.model');
const Course           = require('../courses/course.model');
const Section          = require('../sections/section.model');
const Semester         = require('../semesters/semester.model');
const AcademicYear     = require('../academic-years/academicYear.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const Enrollment       = require('../enrollments/enrollment.model');
const AppError         = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, buildSearchFilter } = require('../../utils/queryHelpers');

const populateAssessment = (query) =>
  query
    .populate('course', 'name code credits')
    .populate('section', 'name year')
    .populate('semester', 'name type')
    .populate({
      path    : 'faculty',
      select  : 'employeeId user',
      populate: { path: 'user', select: 'firstName lastName' },
    });

const listAssessments = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)   filter.course = query.course;
  if (query.section)  filter.section = query.section;
  if (query.semester) filter.semester = query.semester;
  if (query.type)     filter.type = query.type;
  if (query.status)   filter.status = query.status;

  if (caller.role === 'faculty') {
    filter.faculty = caller.facultyProfile;
  } else if (caller.role === 'student') {
    const enrollments = await Enrollment.find({
      student: caller.studentProfile,
      status : { $in: ['enrolled', 'completed'] },
    }).select('course section semester');
    if (enrollments.length === 0) {
      return { assessments: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    filter.$or = enrollments.map((e) => ({ course: e.course, section: e.section, semester: e.semester }));
    filter.status = { $in: ['published', 'ongoing', 'completed'] };
  } else if (query.faculty) {
    filter.faculty = query.faculty;
  }

  const searchFilter = buildSearchFilter(query.search, ['title', 'instructions']);
  if (searchFilter) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }

  const [assessments, total] = await Promise.all([
    populateAssessment(Assessment.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Assessment.countDocuments(filter),
  ]);

  return { assessments, meta: buildPaginationMeta({ page, limit, total }) };
};

const getAssessmentById = async (id, caller) => {
  const assessment = await populateAssessment(Assessment.findById(id));
  if (!assessment) throw new AppError('Assessment not found', 404);

  if (caller.role === 'faculty') {
    const assigned = await CourseAssignment.exists({
      faculty : caller.facultyProfile,
      course  : assessment.course._id,
      section : assessment.section._id,
      semester: assessment.semester._id,
      isActive: true,
    });
    if (!assigned && String(assessment.faculty._id) !== String(caller.facultyProfile)) {
      throw new AppError('You do not have permission to view this assessment.', 403);
    }
  } else if (caller.role === 'student') {
    const enrolled = await Enrollment.exists({
      student : caller.studentProfile,
      course  : assessment.course._id,
      section : assessment.section._id,
      semester: assessment.semester._id,
      status  : { $in: ['enrolled', 'completed'] },
    });
    if (!enrolled || !['published', 'ongoing', 'completed'].includes(assessment.status)) {
      throw new AppError('You do not have permission to view this assessment.', 403);
    }
  }

  return assessment;
};

const createAssessment = async (payload, caller) => {
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
    const assigned = await CourseAssignment.exists({
      faculty : caller.facultyProfile,
      course  : course._id,
      section : section._id,
      semester: semester._id,
      isActive: true,
    });
    if (!assigned) {
      throw new AppError('You are not assigned to create assessments for this course and section.', 403);
    }
  } else {
    facultyId = payload.faculty;
    if (!facultyId) {
      const assignment = await CourseAssignment.findOne({
        course  : course._id,
        section : section._id,
        semester: semester._id,
        isActive: true,
      });
      if (!assignment) throw new AppError('Specify faculty or assign one to this course/section first', 400);
      facultyId = assignment.faculty;
    }
  }

  return Assessment.create({ ...payload, faculty: facultyId });
};

const updateAssessment = async (id, payload, caller) => {
  const assessment = await Assessment.findById(id);
  if (!assessment) throw new AppError('Assessment not found', 404);

  if (caller.role === 'faculty' && String(assessment.faculty) !== String(caller.facultyProfile)) {
    throw new AppError('You can only modify assessments you created.', 403);
  }

  Object.assign(assessment, payload);
  await assessment.save();
  return assessment;
};

const deleteAssessment = async (id, caller) => {
  const assessment = await Assessment.findById(id);
  if (!assessment) throw new AppError('Assessment not found', 404);

  if (caller.role === 'faculty' && String(assessment.faculty) !== String(caller.facultyProfile)) {
    throw new AppError('You can only delete assessments you created.', 403);
  }

  assessment.status = 'cancelled';
  await assessment.save();
};

module.exports = {
  listAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
};

