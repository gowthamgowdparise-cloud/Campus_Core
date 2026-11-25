'use strict';

const Timetable        = require('./timetable.model');
const Section          = require('../sections/section.model');
const Semester         = require('../semesters/semester.model');
const AcademicYear     = require('../academic-years/academicYear.model');
const Student          = require('../students/student.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const AppError         = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }     = require('../../utils/queryHelpers');

const populateTimetable = (query) =>
  query
    .populate('section', 'name year semesterNumber')
    .populate('semester', 'name type isCurrent')
    .populate('academicYear', 'name isCurrent')
    .populate('schedule.periods.course', 'name code type')
    .populate({
      path    : 'schedule.periods.faculty',
      select  : 'employeeId designation user',
      populate: { path: 'user', select: 'firstName lastName' },
    });

/**
 * Prevent faculty double-booking in the same semester across active timetables.
 */
const assertNoFacultyConflict = async ({ semesterId, schedule, excludeTimetableId = null }) => {
  const slots = [];
  for (const dayRow of schedule || []) {
    for (const p of dayRow.periods || []) {
      if (p.faculty) {
        slots.push({ day: dayRow.day, periodNumber: p.periodNumber, faculty: String(p.faculty) });
      }
    }
  }
  if (slots.length === 0) return;

  const filter = { semester: semesterId, isActive: true, status: { $ne: 'archived' } };
  if (excludeTimetableId) filter._id = { $ne: excludeTimetableId };

  const existingTimetables = await Timetable.find(filter).select('section schedule');
  for (const tt of existingTimetables) {
    for (const dayRow of tt.schedule) {
      for (const p of dayRow.periods) {
        if (!p.faculty) continue;
        const conflict = slots.find(
          (s) => s.day === dayRow.day && s.periodNumber === p.periodNumber && s.faculty === String(p.faculty)
        );
        if (conflict) {
          throw new AppError(
            `Timetable conflict: faculty ${conflict.faculty} is already scheduled on ${conflict.day} period ${conflict.periodNumber}.`,
            409
          );
        }
      }
    }
  }
};

const listTimetables = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.section)              filter.section = query.section;
  if (query.semester)             filter.semester = query.semester;
  if (query.academicYear)         filter.academicYear = query.academicYear;
  if (query.isActive !== undefined) filter.isActive = query.isActive;
  if (query.status)               filter.status = query.status;

  if (caller.role === 'student') {
    const student = await Student.findById(caller.studentProfile).select('currentSection');
    if (!student || !student.currentSection) {
      return { timetables: [], meta: buildPaginationMeta({ page, limit, total: 0 }) };
    }
    filter.section = student.currentSection;
    filter.status  = 'published';
    filter.isActive = true;
  } else if (caller.role === 'faculty') {
    const sections = await CourseAssignment.find({ faculty: caller.facultyProfile, isActive: true }).distinct('section');
    filter.$or = [{ 'schedule.periods.faculty': caller.facultyProfile }, { section: { $in: sections } }];
    filter.status = 'published';
  }

  const [timetables, total] = await Promise.all([
    populateTimetable(Timetable.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit),
    Timetable.countDocuments(filter),
  ]);

  return { timetables, meta: buildPaginationMeta({ page, limit, total }) };
};

const getMyTimetable = async (caller, query) => {
  if (caller.role === 'student') {
    const student = await Student.findById(caller.studentProfile).select('currentSection');
    if (!student || !student.currentSection) {
      throw new AppError('No section is currently assigned to your student profile', 404);
    }
    const filter = { section: student.currentSection, status: 'published', isActive: true };
    if (query.semester) filter.semester = query.semester;
    return populateTimetable(Timetable.find(filter)).sort({ effectiveFrom: -1 });
  }

  if (caller.role === 'faculty') {
    const filter = {
      status                    : 'published',
      isActive                  : true,
      'schedule.periods.faculty': caller.facultyProfile,
    };
    if (query.semester) filter.semester = query.semester;
    return populateTimetable(Timetable.find(filter)).sort({ effectiveFrom: -1 });
  }

  return listTimetables(query, caller);
};

const getTimetableById = async (id, caller) => {
  const tt = await populateTimetable(Timetable.findById(id));
  if (!tt) throw new AppError('Timetable not found', 404);

  if (caller.role === 'student') {
    const stu = await Student.findById(caller.studentProfile).select('currentSection');
    if (!stu || String(stu.currentSection) !== String(tt.section._id) || tt.status !== 'published') {
      throw new AppError('You do not have permission to view this timetable.', 403);
    }
  }
  return tt;
};

const createTimetable = async (payload, actorId) => {
  const [section, semester, ay] = await Promise.all([
    Section.findById(payload.section),
    Semester.findById(payload.semester),
    AcademicYear.findById(payload.academicYear),
  ]);
  if (!section)  throw new AppError('Section not found', 404);
  if (!semester) throw new AppError('Semester not found', 404);
  if (!ay)       throw new AppError('Academic year not found', 404);

  await assertNoFacultyConflict({ semesterId: payload.semester, schedule: payload.schedule });

  return Timetable.create({ ...payload, createdBy: actorId });
};

const updateTimetable = async (id, payload) => {
  const tt = await Timetable.findById(id);
  if (!tt) throw new AppError('Timetable not found', 404);

  if (payload.schedule) {
    await assertNoFacultyConflict({
      semesterId        : tt.semester,
      schedule          : payload.schedule,
      excludeTimetableId: tt._id,
    });
  }

  Object.assign(tt, payload);
  await tt.save();
  return populateTimetable(Timetable.findById(tt._id));
};

const publishTimetable = async (id, actorId) => {
  const tt = await Timetable.findById(id);
  if (!tt) throw new AppError('Timetable not found', 404);

  await assertNoFacultyConflict({
    semesterId        : tt.semester,
    schedule          : tt.schedule,
    excludeTimetableId: tt._id,
  });

  tt.status     = 'published';
  tt.approvedBy = actorId;
  await tt.save();
  return tt;
};

module.exports = {
  listTimetables,
  getMyTimetable,
  getTimetableById,
  createTimetable,
  updateTimetable,
  publishTimetable,
};

