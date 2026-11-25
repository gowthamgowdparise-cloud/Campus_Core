'use strict';

const Semester     = require('./semester.model');
const AcademicYear = require('../academic-years/academicYear.model');
const AppError     = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['startDate', 'endDate', 'name', 'type', 'createdAt'];

const listSemesters = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { startDate: -1 });

  const filter = {};
  if (query.academicYear)           filter.academicYear = query.academicYear;
  if (query.type)                   filter.type = query.type;
  if (query.status)                 filter.status = query.status;
  if (query.isCurrent !== undefined) filter.isCurrent = query.isCurrent;
  const searchFilter = buildSearchFilter(query.search, ['name']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [semesters, total] = await Promise.all([
    Semester.find(filter)
      .populate('academicYear', 'name isCurrent status')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Semester.countDocuments(filter),
  ]);

  return { semesters, meta: buildPaginationMeta({ page, limit, total }) };
};

const getCurrentSemester = async () => {
  const sem = await Semester.findOne({ isCurrent: true }).populate('academicYear', 'name isCurrent status');
  if (!sem) throw new AppError('No current semester is configured', 404);
  return sem;
};

const getSemesterById = async (id) => {
  const sem = await Semester.findById(id).populate('academicYear', 'name startDate endDate isCurrent');
  if (!sem) throw new AppError('Semester not found', 404);
  return sem;
};

const createSemester = async (payload) => {
  const ay = await AcademicYear.findById(payload.academicYear);
  if (!ay) throw new AppError('Academic year not found', 404);
  return Semester.create(payload);
};

const updateSemester = async (id, payload) => {
  const sem = await Semester.findById(id);
  if (!sem) throw new AppError('Semester not found', 404);
  Object.assign(sem, payload);
  await sem.save();
  return sem;
};

module.exports = {
  listSemesters,
  getCurrentSemester,
  getSemesterById,
  createSemester,
  updateSemester,
};

