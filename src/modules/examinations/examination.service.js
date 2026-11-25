'use strict';

const Examination  = require('./examination.model');
const AcademicYear = require('../academic-years/academicYear.model');
const Semester     = require('../semesters/semester.model');
const Program      = require('../programs/program.model');
const Department   = require('../departments/department.model');
const Course       = require('../courses/course.model');
const Student      = require('../students/student.model');
const AppError     = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, buildSearchFilter } = require('../../utils/queryHelpers');

const populateExam = (query) =>
  query
    .populate('academicYear', 'name isCurrent')
    .populate('semester', 'name type')
    .populate('program', 'name code shortName')
    .populate('department', 'name code')
    .populate('examSchedule.course', 'name code credits')
    .populate({
      path    : 'examSchedule.invigilator',
      select  : 'employeeId user',
      populate: { path: 'user', select: 'firstName lastName' },
    });

const validateExamScheduleSlots = async (examSchedule, startDate, endDate) => {
  if (!examSchedule || examSchedule.length === 0) return;

  const start = new Date(startDate);
  const end   = new Date(endDate);
  const courseIds = examSchedule.map((s) => s.course);
  const existingCount = await Course.countDocuments({ _id: { $in: Array.from(new Set(courseIds.map(String))) } });
  if (existingCount !== new Set(courseIds.map(String)).size) {
    throw new AppError('One or more courses in examSchedule do not exist', 404);
  }

  for (const slot of examSchedule) {
    const slotDate = new Date(slot.examDate);
    if (slotDate < start || slotDate > end) {
      throw new AppError('Every exam schedule slot examDate must fall within examination startDate and endDate', 400);
    }
  }
};

const listExaminations = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.semester)     filter.semester = query.semester;
  if (query.program)      filter.program = query.program;
  if (query.department)   filter.department = query.department;
  if (query.type)         filter.type = query.type;
  if (query.status)       filter.status = query.status;

  if (caller.role === 'student') {
    const student = await Student.findById(caller.studentProfile).select('program');
    if (!student) throw new AppError('Student profile not found', 404);
    filter.program = student.program;
    if (!query.status) filter.status = { $ne: 'cancelled' };
  }

  const searchFilter = buildSearchFilter(query.search, ['name']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [examinations, total] = await Promise.all([
    populateExam(Examination.find(filter)).sort({ startDate: -1 }).skip(skip).limit(limit),
    Examination.countDocuments(filter),
  ]);

  return { examinations, meta: buildPaginationMeta({ page, limit, total }) };
};

const getExaminationById = async (id, caller) => {
  const exam = await populateExam(Examination.findById(id));
  if (!exam) throw new AppError('Examination not found', 404);

  if (caller.role === 'student') {
    const student = await Student.findById(caller.studentProfile).select('program');
    if (!student || String(student.program) !== String(exam.program._id)) {
      throw new AppError('You do not have permission to view this examination schedule.', 403);
    }
  }
  return exam;
};

const createExamination = async (payload, actorId) => {
  const [ay, sem, prog, dept] = await Promise.all([
    AcademicYear.findById(payload.academicYear),
    Semester.findById(payload.semester),
    Program.findById(payload.program),
    Department.findById(payload.department),
  ]);

  if (!ay)   throw new AppError('Academic year not found', 404);
  if (!sem)  throw new AppError('Semester not found', 404);
  if (!prog) throw new AppError('Program not found', 404);
  if (!dept) throw new AppError('Department not found', 404);

  await validateExamScheduleSlots(payload.examSchedule, payload.startDate, payload.endDate);

  const exam = await Examination.create({ ...payload, createdBy: actorId });
  return populateExam(Examination.findById(exam._id));
};

const updateExamination = async (id, payload) => {
  const exam = await Examination.findById(id);
  if (!exam) throw new AppError('Examination not found', 404);

  Object.assign(exam, payload);
  await exam.save();
  return populateExam(Examination.findById(exam._id));
};

const updateExaminationSchedule = async (id, examSchedule) => {
  const exam = await Examination.findById(id);
  if (!exam) throw new AppError('Examination not found', 404);

  await validateExamScheduleSlots(examSchedule, exam.startDate, exam.endDate);
  exam.examSchedule = examSchedule;
  await exam.save();
  return populateExam(Examination.findById(exam._id));
};

const updateExaminationStatus = async (id, status, actorId) => {
  const exam = await Examination.findById(id);
  if (!exam) throw new AppError('Examination not found', 404);

  exam.status = status;
  if (status === 'result_declared') {
    exam.approvedBy = actorId;
  }
  await exam.save();
  return exam;
};

module.exports = {
  listExaminations,
  getExaminationById,
  createExamination,
  updateExamination,
  updateExaminationSchedule,
  updateExaminationStatus,
};

