'use strict';

const Section          = require('./section.model');
const Program          = require('../programs/program.model');
const Department       = require('../departments/department.model');
const AcademicYear     = require('../academic-years/academicYear.model');
const Semester         = require('../semesters/semester.model');
const Faculty          = require('../faculty/faculty.model');
const Student          = require('../students/student.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const AppError         = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['name', 'year', 'semesterNumber', 'createdAt'];

const listSections = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { name: 1 });

  const filter = {};
  if (query.program)              filter.program = query.program;
  if (query.department)           filter.department = query.department;
  if (query.academicYear)         filter.academicYear = query.academicYear;
  if (query.semester)             filter.semester = query.semester;
  if (query.year)                 filter.year = query.year;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  // Scope non-admin queries cleanly
  if (caller.role === 'student') {
    const stu = await Student.findById(caller.studentProfile).select('currentSection');
    if (!stu || !stu.currentSection) {
      return { sections: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    filter._id = stu.currentSection;
  } else if (caller.role === 'faculty') {
    const assignments = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true }).distinct('section');
    filter.$or = [{ classTeacher: caller.facultyProfile }, { _id: { $in: assignments } }];
  }

  const searchFilter = buildSearchFilter(query.search, ['name']);
  if (searchFilter) {
    if (filter.$or) {
      filter.$and = [{ $or: filter.$or }, searchFilter];
      delete filter.$or;
    } else {
      Object.assign(filter, searchFilter);
    }
  }

  const [sections, total] = await Promise.all([
    Section.find(filter)
      .populate('program', 'name code shortName')
      .populate('department', 'name code')
      .populate('academicYear', 'name isCurrent')
      .populate('semester', 'name type isCurrent')
      .populate({
        path    : 'classTeacher',
        select  : 'employeeId designation user',
        populate: { path: 'user', select: 'firstName lastName email' },
      })
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Section.countDocuments(filter),
  ]);

  return { sections, meta: buildPaginationMeta({ page, limit, total }) };
};

const getSectionById = async (id, caller) => {
  const section = await Section.findById(id)
    .populate('program', 'name code shortName')
    .populate('department', 'name code')
    .populate('academicYear', 'name isCurrent')
    .populate('semester', 'name type isCurrent')
    .populate({
      path    : 'classTeacher',
      select  : 'employeeId designation user',
      populate: { path: 'user', select: 'firstName lastName email' },
    });

  if (!section) throw new AppError('Section not found', 404);

  if (caller.role === 'student') {
    const stu = await Student.findById(caller.studentProfile).select('currentSection');
    if (!stu || String(stu.currentSection) !== String(section._id)) {
      throw new AppError('You do not have permission to access this section.', 403);
    }
  } else if (caller.role === 'faculty') {
    const isClassTeacher = section.classTeacher && String(section.classTeacher._id) === String(caller.facultyProfile);
    const assigned = await CourseAssignment.exists({
      faculty : caller.facultyProfile,
      section : section._id,
      isActive: true,
    });
    if (!isClassTeacher && !assigned) {
      throw new AppError('You do not have permission to access this section.', 403);
    }
  }

  return section;
};

const createSection = async (payload) => {
  const [prog, dept, ay, sem] = await Promise.all([
    Program.findById(payload.program),
    Department.findById(payload.department),
    AcademicYear.findById(payload.academicYear),
    Semester.findById(payload.semester),
  ]);

  if (!prog) throw new AppError('Program not found', 404);
  if (!dept) throw new AppError('Department not found', 404);
  if (!ay)   throw new AppError('Academic year not found', 404);
  if (!sem)  throw new AppError('Semester not found', 404);

  if (String(prog.department) !== String(dept._id)) {
    throw new AppError('Program does not belong to the specified department', 400);
  }
  if (String(sem.academicYear) !== String(ay._id)) {
    throw new AppError('Semester does not belong to the specified academic year', 400);
  }

  if (payload.classTeacher) {
    const fac = await Faculty.findById(payload.classTeacher);
    if (!fac || fac.status !== 'active') {
      throw new AppError('Valid active faculty member required for classTeacher', 404);
    }
  }

  return Section.create(payload);
};

const updateSection = async (id, payload) => {
  const section = await Section.findById(id);
  if (!section) throw new AppError('Section not found', 404);
  Object.assign(section, payload);
  await section.save();
  return section;
};

const assignClassTeacher = async (id, facultyId) => {
  return runInTransaction(async (session) => {
    const section = await Section.findById(id).session(session);
    if (!section) throw new AppError('Section not found', 404);

    if (section.classTeacher && String(section.classTeacher) !== String(facultyId || '')) {
      await Faculty.updateOne(
        { _id: section.classTeacher },
        { $set: { isClassTeacher: false, classTeacherOf: null } },
        { session }
      );
    }

    if (facultyId) {
      const fac = await Faculty.findById(facultyId).session(session);
      if (!fac || fac.status !== 'active') {
        throw new AppError('Valid active faculty member required', 404);
      }
      fac.isClassTeacher = true;
      fac.classTeacherOf = section._id;
      await fac.save({ session });
      section.classTeacher = fac._id;
    } else {
      section.classTeacher = null;
    }

    await section.save({ session });
    return section;
  });
};

module.exports = {
  listSections,
  getSectionById,
  createSection,
  updateSection,
  assignClassTeacher,
};

