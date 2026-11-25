'use strict';

const Program    = require('./program.model');
const Department = require('../departments/department.model');
const Student    = require('../students/student.model');
const Course     = require('../courses/course.model');
const Section    = require('../sections/section.model');
const AppError   = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['name', 'code', 'type', 'duration', 'createdAt'];

const listPrograms = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { name: 1 });

  const filter = {};
  if (query.department)          filter.department = query.department;
  if (query.type)                filter.type = query.type;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  const searchFilter = buildSearchFilter(query.search, ['name', 'code', 'shortName']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [programs, total] = await Promise.all([
    Program.find(filter)
      .populate('department', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Program.countDocuments(filter),
  ]);

  return { programs, meta: buildPaginationMeta({ page, limit, total }) };
};

const getProgramById = async (id) => {
  const program = await Program.findById(id).populate('department', 'name code');
  if (!program) throw new AppError('Program not found', 404);
  return program;
};

const createProgram = async (payload) => {
  const dept = await Department.findById(payload.department);
  if (!dept || !dept.isActive) {
    throw new AppError('Valid active department is required', 404);
  }
  return Program.create(payload);
};

const updateProgram = async (id, payload) => {
  const program = await Program.findById(id);
  if (!program) throw new AppError('Program not found', 404);

  if (payload.department) {
    const dept = await Department.findById(payload.department);
    if (!dept || !dept.isActive) {
      throw new AppError('Valid active department is required', 404);
    }
  }

  Object.assign(program, payload);
  await program.save();
  return program;
};

const deleteProgram = async (id, actorId) => {
  const program = await Program.findById(id);
  if (!program) throw new AppError('Program not found', 404);

  const [students, courses, sections] = await Promise.all([
    Student.countDocuments({ program: id }),
    Course.countDocuments({ program: id }),
    Section.countDocuments({ program: id }),
  ]);

  if (students > 0 || courses > 0 || sections > 0) {
    throw new AppError('Cannot delete program with existing students, courses, or sections.', 409);
  }

  program.isDeleted = true;
  program.deletedAt = new Date();
  program.deletedBy = actorId;
  program.isActive  = false;
  await program.save();
};

module.exports = {
  listPrograms,
  getProgramById,
  createProgram,
  updateProgram,
  deleteProgram,
};

