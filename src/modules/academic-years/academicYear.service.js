'use strict';

const AcademicYear          = require('./academicYear.model');
const AcademicCalendarEvent = require('./academicCalendar.model');
const Semester              = require('../semesters/semester.model');
const Department            = require('../departments/department.model');
const Student               = require('../students/student.model');
const AppError              = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['startDate', 'endDate', 'name', 'createdAt'];

const listAcademicYears = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { startDate: -1 });

  const filter = {};
  if (query.status)                 filter.status = query.status;
  if (query.isCurrent !== undefined) filter.isCurrent = query.isCurrent;
  const searchFilter = buildSearchFilter(query.search, ['name', 'description']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [academicYears, total] = await Promise.all([
    AcademicYear.find(filter).sort(sort).skip(skip).limit(limit),
    AcademicYear.countDocuments(filter),
  ]);

  return { academicYears, meta: buildPaginationMeta({ page, limit, total }) };
};

const getCurrentAcademicYear = async () => {
  const current = await AcademicYear.findOne({ isCurrent: true });
  if (!current) throw new AppError('No current academic year is configured', 404);
  return current;
};

const getAcademicYearById = async (id) => {
  const ay = await AcademicYear.findById(id);
  if (!ay) throw new AppError('Academic year not found', 404);
  return ay;
};

const createAcademicYear = async (payload) => AcademicYear.create(payload);

const updateAcademicYear = async (id, payload) => {
  const ay = await AcademicYear.findById(id);
  if (!ay) throw new AppError('Academic year not found', 404);
  Object.assign(ay, payload);
  await ay.save();
  return ay;
};

const deleteAcademicYear = async (id) => {
  const ay = await AcademicYear.findById(id);
  if (!ay) throw new AppError('Academic year not found', 404);

  const [semCount, stuCount] = await Promise.all([
    Semester.countDocuments({ academicYear: id }),
    Student.countDocuments({ academicYear: id }),
  ]);
  if (semCount > 0 || stuCount > 0) {
    throw new AppError('Cannot delete academic year referenced by semesters or students.', 409);
  }
  await ay.deleteOne();
};

// ── Academic Calendar Events ───────────────────────────────────────────────
const listCalendarEvents = async (query, callerRole) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.semester)     filter.semester = query.semester;
  if (query.department)   filter.department = query.department;
  if (query.eventType)    filter.eventType = query.eventType;
  if (query.from || query.to) {
    filter.startDate = {};
    if (query.from) filter.startDate.$gte = new Date(query.from);
    if (query.to)   filter.startDate.$lte = new Date(query.to);
  }
  if (callerRole !== 'admin') {
    filter.targetRoles = { $in: ['all', callerRole] };
  }
  const searchFilter = buildSearchFilter(query.search, ['title', 'description']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [events, total] = await Promise.all([
    AcademicCalendarEvent.find(filter)
      .populate('academicYear', 'name isCurrent')
      .populate('semester', 'name type')
      .populate('department', 'name code')
      .sort({ startDate: 1 })
      .skip(skip)
      .limit(limit),
    AcademicCalendarEvent.countDocuments(filter),
  ]);

  return { events, meta: buildPaginationMeta({ page, limit, total }) };
};

const createCalendarEvent = async (payload, actorId) => {
  const ay = await AcademicYear.findById(payload.academicYear);
  if (!ay) throw new AppError('Academic year not found', 404);

  if (payload.semester) {
    const sem = await Semester.findById(payload.semester);
    if (!sem) throw new AppError('Semester not found', 404);
  }
  if (payload.department) {
    const dept = await Department.findById(payload.department);
    if (!dept) throw new AppError('Department not found', 404);
  }

  return AcademicCalendarEvent.create({ ...payload, createdBy: actorId });
};

const updateCalendarEvent = async (eventId, payload) => {
  const ev = await AcademicCalendarEvent.findById(eventId);
  if (!ev) throw new AppError('Academic calendar event not found', 404);
  Object.assign(ev, payload);
  await ev.save();
  return ev;
};

const deleteCalendarEvent = async (eventId, actorId) => {
  const ev = await AcademicCalendarEvent.findById(eventId);
  if (!ev) throw new AppError('Academic calendar event not found', 404);
  ev.isDeleted = true;
  ev.deletedAt = new Date();
  ev.deletedBy = actorId;
  await ev.save();
};

module.exports = {
  listAcademicYears,
  getCurrentAcademicYear,
  getAcademicYearById,
  createAcademicYear,
  updateAcademicYear,
  deleteAcademicYear,
  listCalendarEvents,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
};

