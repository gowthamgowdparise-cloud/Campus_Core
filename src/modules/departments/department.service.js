'use strict';

const Department = require('./department.model');
const Faculty    = require('../faculty/faculty.model');
const Program    = require('../programs/program.model');
const Student    = require('../students/student.model');
const AppError   = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['name', 'code', 'establishedYear', 'createdAt'];

const listDepartments = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { name: 1 });

  const filter = {};
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  const searchFilter = buildSearchFilter(query.search, ['name', 'code']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [departments, total] = await Promise.all([
    Department.find(filter)
      .populate({
        path    : 'hod',
        select  : 'employeeId designation user',
        populate: { path: 'user', select: 'firstName lastName email' },
      })
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Department.countDocuments(filter),
  ]);

  return { departments, meta: buildPaginationMeta({ page, limit, total }) };
};

const getDepartmentById = async (id) => {
  const dept = await Department.findById(id).populate({
    path    : 'hod',
    select  : 'employeeId designation user',
    populate: { path: 'user', select: 'firstName lastName email' },
  });
  if (!dept) throw new AppError('Department not found', 404);
  return dept;
};

const createDepartment = async (payload) => {
  if (payload.hod) {
    const faculty = await Faculty.findById(payload.hod);
    if (!faculty) throw new AppError('Specified HOD faculty profile not found', 404);
  }
  const department = await Department.create(payload);
  return department;
};

const updateDepartment = async (id, payload) => {
  const dept = await Department.findById(id);
  if (!dept) throw new AppError('Department not found', 404);

  Object.assign(dept, payload);
  await dept.save();
  return dept;
};

const assignDepartmentHod = async (id, hodId) => {
  return runInTransaction(async (session) => {
    const dept = await Department.findById(id).session(session);
    if (!dept) throw new AppError('Department not found', 404);

    // Clear previous HOD flag if changing/unassigning
    if (dept.hod && dept.hod.toString() !== (hodId || '')) {
      await Faculty.updateOne(
        { _id: dept.hod },
        { $set: { isHOD: false, hodSince: null } },
        { session }
      );
    }

    if (hodId) {
      const faculty = await Faculty.findById(hodId).session(session);
      if (!faculty) throw new AppError('Faculty profile not found', 404);
      if (faculty.status !== 'active') {
        throw new AppError('Only active faculty members can be assigned as HOD', 400);
      }

      faculty.isHOD    = true;
      faculty.hodSince = new Date();
      await faculty.save({ session });
      dept.hod = faculty._id;
    } else {
      dept.hod = null;
    }

    await dept.save({ session });
    return dept;
  });
};

const deleteDepartment = async (id, actorId) => {
  const dept = await Department.findById(id);
  if (!dept) throw new AppError('Department not found', 404);

  const [programCount, facultyCount, studentCount] = await Promise.all([
    Program.countDocuments({ department: id }),
    Faculty.countDocuments({ department: id }),
    Student.countDocuments({ department: id }),
  ]);

  if (programCount > 0 || facultyCount > 0 || studentCount > 0) {
    throw new AppError(
      'Cannot delete department with active programs, faculty, or students.',
      409
    );
  }

  dept.isDeleted = true;
  dept.deletedAt = new Date();
  dept.deletedBy = actorId;
  dept.isActive  = false;
  await dept.save();
};

module.exports = {
  listDepartments,
  getDepartmentById,
  createDepartment,
  updateDepartment,
  assignDepartmentHod,
  deleteDepartment,
};

