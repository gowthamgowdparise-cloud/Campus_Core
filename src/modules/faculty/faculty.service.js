'use strict';

const Faculty          = require('./faculty.model');
const User             = require('../users/user.model');
const Department       = require('../departments/department.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const Enrollment       = require('../enrollments/enrollment.model');
const Timetable        = require('../timetables/timetable.model');
const AppError         = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['employeeId', 'designation', 'joiningDate', 'createdAt'];

const populateFaculty = (query) =>
  query
    .populate('user', 'firstName lastName email phone gender dateOfBirth profilePicture status')
    .populate('department', 'name code')
    .populate('classTeacherOf', 'name year semesterNumber');

const listFaculty = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { createdAt: -1 });

  const filter = {};
  if (query.department)     filter.department = query.department;
  if (query.designation)    filter.designation = query.designation;
  if (query.employmentType) filter.employmentType = query.employmentType;
  if (query.status)         filter.status = query.status;

  const searchFilter = buildSearchFilter(query.search, ['employeeId', 'facultyCode']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [facultyList, total] = await Promise.all([
    populateFaculty(Faculty.find(filter)).sort(sort).skip(skip).limit(limit).lean(),
    Faculty.countDocuments(filter),
  ]);

  return { faculty: facultyList, meta: buildPaginationMeta({ page, limit, total }) };
};

const getFacultyById = async (id, caller) => {
  if (caller.role === 'faculty' && String(caller.facultyProfile) !== String(id)) {
    throw new AppError('You do not have permission to view another faculty member profile.', 403);
  }

  const faculty = await populateFaculty(Faculty.findById(id));
  if (!faculty) throw new AppError('Faculty profile not found', 404);
  return faculty;
};

const getMyFacultyProfile = async (caller) => {
  if (!caller.facultyProfile) {
    throw new AppError('No faculty profile linked to this account', 404);
  }
  const faculty = await populateFaculty(Faculty.findById(caller.facultyProfile));
  if (!faculty) throw new AppError('Faculty profile not found', 404);
  return faculty;
};

const createFaculty = async (payload) => {
  const email = payload.email.toLowerCase();

  return runInTransaction(async (session) => {
    const existingUser = await User.findOne({ email }).setOptions({ includeDeleted: true }).session(session);
    const dept         = await Department.findById(payload.department).session(session);
    const dupEmp       = await Faculty.findOne({ employeeId: payload.employeeId }).setOptions({ includeDeleted: true }).session(session);

    if (existingUser) throw new AppError(`User with email "${email}" already exists.`, 409);
    if (!dept || !dept.isActive) throw new AppError('Valid active department is required.', 404);
    if (dupEmp) throw new AppError(`Faculty employeeId "${payload.employeeId}" already exists.`, 409);

    if (payload.facultyCode) {
      const dupCode = await Faculty.findOne({ facultyCode: payload.facultyCode }).setOptions({ includeDeleted: true }).session(session);
      if (dupCode) throw new AppError(`Faculty code "${payload.facultyCode}" already exists.`, 409);
    }

    const [user] = await User.create(
      [
        {
          firstName         : payload.firstName,
          lastName          : payload.lastName,
          email,
          passwordHash      : payload.password,
          role              : 'faculty',
          status            : 'active',
          phone             : payload.phone,
          gender            : payload.gender,
          dateOfBirth       : payload.dateOfBirth,
          mustChangePassword: payload.mustChangePassword ?? true,
        },
      ],
      { session }
    );

    const [faculty] = await Faculty.create(
      [
        {
          user                : user._id,
          department          : payload.department,
          employeeId          : payload.employeeId,
          facultyCode         : payload.facultyCode || undefined,
          designation         : payload.designation,
          specialization      : payload.specialization,
          qualifications      : payload.qualifications,
          experience          : payload.experience,
          totalExperienceYears: payload.totalExperienceYears,
          employmentType      : payload.employmentType,
          joiningDate         : payload.joiningDate,
          researchInterests   : payload.researchInterests,
          publications        : payload.publications,
        },
      ],
      { session }
    );

    user.facultyProfile = faculty._id;
    await user.save({ session });

    return populateFaculty(Faculty.findById(faculty._id).session(session));
  });
};

const updateFaculty = async (id, payload) => {
  return runInTransaction(async (session) => {
    const faculty = await Faculty.findById(id).session(session);
    if (!faculty) throw new AppError('Faculty profile not found', 404);

    if (payload.department) {
      const dept = await Department.findById(payload.department).session(session);
      if (!dept || !dept.isActive) throw new AppError('Valid active department is required', 404);
    }

    const userFields = {};
    for (const f of ['firstName', 'lastName', 'phone']) {
      if (payload[f] !== undefined) userFields[f] = payload[f];
    }
    if (Object.keys(userFields).length > 0) {
      await User.updateOne({ _id: faculty.user }, { $set: userFields }, { session });
    }

    const facFields = [
      'department', 'designation', 'specialization', 'qualifications', 'experience',
      'totalExperienceYears', 'employmentType', 'relievingDate', 'researchInterests',
      'publications', 'status',
    ];
    for (const f of facFields) {
      if (payload[f] !== undefined) faculty[f] = payload[f];
    }
    await faculty.save({ session });

    return populateFaculty(Faculty.findById(faculty._id).session(session));
  });
};

const updateMyProfile = async (caller, payload) => {
  if (!caller.facultyProfile) throw new AppError('No faculty profile linked to this account', 404);

  return runInTransaction(async (session) => {
    const faculty = await Faculty.findById(caller.facultyProfile).session(session);
    if (!faculty) throw new AppError('Faculty profile not found', 404);

    const userFields = {};
    if (payload.phone !== undefined)          userFields.phone = payload.phone;
    if (payload.profilePicture !== undefined) userFields.profilePicture = payload.profilePicture;
    if (Object.keys(userFields).length > 0) {
      await User.updateOne({ _id: faculty.user }, { $set: userFields }, { session });
    }

    for (const f of ['specialization', 'qualifications', 'researchInterests', 'publications']) {
      if (payload[f] !== undefined) faculty[f] = payload[f];
    }
    await faculty.save({ session });

    return populateFaculty(Faculty.findById(faculty._id).session(session));
  });
};

const deleteFaculty = async (id, actorId) => {
  return runInTransaction(async (session) => {
    const faculty = await Faculty.findById(id).session(session);
    if (!faculty) throw new AppError('Faculty profile not found', 404);

    faculty.isDeleted = true;
    faculty.deletedAt = new Date();
    faculty.deletedBy = actorId;
    faculty.status    = 'terminated';
    await faculty.save({ session });

    await User.updateOne(
      { _id: faculty.user },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId, status: 'inactive', refreshTokens: [] }, $inc: { tokenVersion: 1 } },
      { session }
    );
  });
};

const getAssignedCourses = async (caller, query) => {
  if (!caller.facultyProfile) throw new AppError('No faculty profile linked to this account', 404);

  const filter = { faculty: caller.facultyProfile, isActive: true };
  if (query.semester) filter.semester = query.semester;

  return CourseAssignment.find(filter)
    .populate('course', 'name code credits type category semesterNumber totalMarks passingMarks')
    .populate('section', 'name year semesterNumber maxStrength currentStrength')
    .populate('semester', 'name type isCurrent startDate endDate')
    .populate('academicYear', 'name isCurrent')
    .sort({ createdAt: -1 });
};

const getAssignedStudents = async (caller, query) => {
  if (!caller.facultyProfile) throw new AppError('No faculty profile linked to this account', 404);

  const assignmentFilter = { faculty: caller.facultyProfile, isActive: true };
  if (query.course)   assignmentFilter.course = query.course;
  if (query.section)  assignmentFilter.section = query.section;
  if (query.semester) assignmentFilter.semester = query.semester;

  const assignments = await CourseAssignment.find(assignmentFilter).select('course section semester');
  if (assignments.length === 0) {
    return { enrollments: [], meta: buildPaginationMeta({ page: 1, limit: 20, total: 0 }) };
  }

  const orConditions = assignments.map((a) => ({
    course  : a.course,
    section : a.section,
    semester: a.semester,
  }));

  const { page, limit, skip } = parsePagination(query);
  const filter = { $or: orConditions, status: { $in: ['enrolled', 'completed'] } };

  const [enrollments, total] = await Promise.all([
    Enrollment.find(filter)
      .populate({
        path    : 'student',
        select  : 'rollNumber enrollmentNumber currentSemester user department program',
        populate: { path: 'user', select: 'firstName lastName email phone' },
      })
      .populate('course', 'name code')
      .populate('section', 'name')
      .populate('semester', 'name type')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit),
    Enrollment.countDocuments(filter),
  ]);

  return { enrollments, meta: buildPaginationMeta({ page, limit, total }) };
};

const getMyTimetable = async (caller, semesterId = null) => {
  if (!caller.facultyProfile) throw new AppError('No faculty profile linked to this account', 404);

  const filter = {
    isActive                   : true,
    status                     : 'published',
    'schedule.periods.faculty' : caller.facultyProfile,
  };
  if (semesterId) filter.semester = semesterId;

  const timetables = await Timetable.find(filter)
    .populate('section', 'name year semesterNumber')
    .populate('semester', 'name type')
    .populate('schedule.periods.course', 'name code');

  // Project only slots assigned to this faculty member
  const slots = [];
  for (const tt of timetables) {
    for (const dayEntry of tt.schedule) {
      for (const period of dayEntry.periods) {
        if (period.faculty && String(period.faculty) === String(caller.facultyProfile)) {
          slots.push({
            timetableId : tt._id,
            section     : tt.section,
            semester    : tt.semester,
            day         : dayEntry.day,
            periodNumber: period.periodNumber,
            startTime   : period.startTime,
            endTime     : period.endTime,
            course      : period.course,
            room        : period.room,
            type        : period.type,
          });
        }
      }
    }
  }

  return slots;
};

module.exports = {
  listFaculty,
  getFacultyById,
  getMyFacultyProfile,
  createFaculty,
  updateFaculty,
  updateMyProfile,
  deleteFaculty,
  getAssignedCourses,
  getAssignedStudents,
  getMyTimetable,
};

