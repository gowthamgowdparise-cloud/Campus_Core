'use strict';

const Student          = require('./student.model');
const User             = require('../users/user.model');
const Department       = require('../departments/department.model');
const Program          = require('../programs/program.model');
const AcademicYear     = require('../academic-years/academicYear.model');
const Section          = require('../sections/section.model');
const Enrollment       = require('../enrollments/enrollment.model');
const Result           = require('../results/result.model');
const CourseAssignment = require('../courses/courseAssignment.model');
const AppError         = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');

const ALLOWED_SORT = ['rollNumber', 'batchYear', 'currentSemester', 'cgpa', 'admissionDate', 'createdAt'];

const populateStudent = (query) =>
  query
    .populate('user', 'firstName lastName email phone gender dateOfBirth profilePicture status')
    .populate('department', 'name code')
    .populate('program', 'name code shortName type duration totalSemesters')
    .populate('academicYear', 'name isCurrent')
    .populate('currentSection', 'name year semesterNumber');

const getFacultyAllowedStudentIds = async (facultyProfileId) => {
  const [assignments, ownSections] = await Promise.all([
    CourseAssignment.find({ faculty: facultyProfileId, isActive: true }).select('course section semester'),
    Section.find({ classTeacher: facultyProfileId }).distinct('_id'),
  ]);

  const enrollOr = assignments.map((a) => ({
    course  : a.course,
    section : a.section,
    semester: a.semester,
  }));

  const [enrolledIds, sectionStudentIds] = await Promise.all([
    enrollOr.length > 0 ? Enrollment.find({ $or: enrollOr }).distinct('student') : [],
    ownSections.length > 0 ? Student.find({ currentSection: { $in: ownSections } }).distinct('_id') : [],
  ]);

  return Array.from(new Set([...enrolledIds.map(String), ...sectionStudentIds.map(String)]));
};

const listStudents = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { createdAt: -1 });

  const filter = {};
  if (query.department)      filter.department = query.department;
  if (query.program)         filter.program = query.program;
  if (query.academicYear)    filter.academicYear = query.academicYear;
  if (query.currentSection)  filter.currentSection = query.currentSection;
  if (query.currentSemester) filter.currentSemester = Number(query.currentSemester);
  if (query.batchYear)       filter.batchYear = Number(query.batchYear);
  if (query.status)          filter.status = query.status;

  if (caller.role === 'faculty') {
    if (!caller.facultyProfile) throw new AppError('Faculty profile not linked', 403);
    const allowedIds = await getFacultyAllowedStudentIds(caller.facultyProfile);
    filter._id = { $in: allowedIds };
  }

  const searchFilter = buildSearchFilter(query.search, ['rollNumber', 'enrollmentNumber', 'admissionNumber']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [students, total] = await Promise.all([
    populateStudent(Student.find(filter)).sort(sort).skip(skip).limit(limit).lean(),
    Student.countDocuments(filter),
  ]);

  return { students, meta: buildPaginationMeta({ page, limit, total }) };
};

const getStudentById = async (id, caller) => {
  if (caller.role === 'student' && String(caller.studentProfile) !== String(id)) {
    throw new AppError('You do not have permission to access another student record.', 403);
  }

  if (caller.role === 'faculty') {
    const allowedIds = await getFacultyAllowedStudentIds(caller.facultyProfile);
    if (!allowedIds.includes(String(id))) {
      throw new AppError('You do not have permission to access a student outside your assigned classes.', 403);
    }
  }

  const student = await populateStudent(Student.findById(id));
  if (!student) throw new AppError('Student record not found', 404);
  return student;
};

const getMyProfile = async (caller) => {
  if (!caller.studentProfile) {
    throw new AppError('No student profile linked to this account', 404);
  }
  const student = await populateStudent(Student.findById(caller.studentProfile));
  if (!student) throw new AppError('Student profile not found', 404);
  return student;
};

const createStudent = async (payload) => {
  const email = payload.email.toLowerCase();

  return runInTransaction(async (session) => {
    const existingUser = await User.findOne({ email }).setOptions({ includeDeleted: true }).session(session);
    const dept         = await Department.findById(payload.department).session(session);
    const prog         = await Program.findById(payload.program).session(session);
    const ay           = await AcademicYear.findById(payload.academicYear).session(session);
    const dupRoll      = await Student.findOne({ rollNumber: payload.rollNumber }).setOptions({ includeDeleted: true }).session(session);

    if (existingUser)            throw new AppError(`User with email "${email}" already exists.`, 409);
    if (!dept || !dept.isActive) throw new AppError('Valid active department is required.', 404);
    if (!prog || !prog.isActive) throw new AppError('Valid active program is required.', 404);
    if (String(prog.department) !== String(dept._id)) {
      throw new AppError('Program does not belong to the specified department.', 400);
    }
    if (!ay)     throw new AppError('Academic year not found.', 404);
    if (dupRoll) throw new AppError(`Roll number "${payload.rollNumber}" already exists.`, 409);

    if (payload.enrollmentNumber) {
      const dupEnroll = await Student.findOne({ enrollmentNumber: payload.enrollmentNumber })
        .setOptions({ includeDeleted: true }).session(session);
      if (dupEnroll) throw new AppError(`Enrollment number "${payload.enrollmentNumber}" already exists.`, 409);
    }
    if (payload.admissionNumber) {
      const dupAdm = await Student.findOne({ admissionNumber: payload.admissionNumber })
        .setOptions({ includeDeleted: true }).session(session);
      if (dupAdm) throw new AppError(`Admission number "${payload.admissionNumber}" already exists.`, 409);
    }

    if (payload.currentSection) {
      const section = await Section.findById(payload.currentSection).session(session);
      if (!section || !section.isActive) throw new AppError('Valid active section not found.', 404);
      if (String(section.program) !== String(prog._id)) {
        throw new AppError('Section does not belong to the specified program.', 400);
      }
      if (section.currentStrength >= section.maxStrength) {
        throw new AppError('Selected section has reached maximum capacity.', 409);
      }
      section.currentStrength += 1;
      await section.save({ session });
    }

    const [user] = await User.create(
      [
        {
          firstName         : payload.firstName,
          lastName          : payload.lastName,
          email,
          passwordHash      : payload.password,
          role              : 'student',
          status            : 'active',
          phone             : payload.phone,
          gender            : payload.gender,
          dateOfBirth       : payload.dateOfBirth,
          mustChangePassword: payload.mustChangePassword ?? true,
        },
      ],
      { session }
    );

    const [student] = await Student.create(
      [
        {
          user                   : user._id,
          department             : payload.department,
          program                : payload.program,
          academicYear           : payload.academicYear,
          currentSection         : payload.currentSection || null,
          rollNumber             : payload.rollNumber,
          enrollmentNumber       : payload.enrollmentNumber || undefined,
          admissionNumber        : payload.admissionNumber || undefined,
          bloodGroup             : payload.bloodGroup,
          nationality            : payload.nationality,
          religion               : payload.religion,
          caste                  : payload.caste,
          motherTongue           : payload.motherTongue,
          isPhysicallyHandicapped: payload.isPhysicallyHandicapped,
          disabilityDetails      : payload.disabilityDetails,
          admissionDate          : payload.admissionDate,
          admissionType          : payload.admissionType,
          currentSemester        : payload.currentSemester,
          currentYear            : payload.currentYear,
          batchYear              : payload.batchYear,
          presentAddress         : payload.presentAddress,
          permanentAddress       : payload.permanentAddress,
          guardian               : payload.guardian,
          previousQualifications : payload.previousQualifications,
        },
      ],
      { session }
    );

    user.studentProfile = student._id;
    await user.save({ session });

    return populateStudent(Student.findById(student._id).session(session));
  });
};

const updateStudent = async (id, payload) => {
  return runInTransaction(async (session) => {
    const student = await Student.findById(id).session(session);
    if (!student) throw new AppError('Student record not found', 404);

    if (payload.currentSection !== undefined && String(payload.currentSection || '') !== String(student.currentSection || '')) {
      if (student.currentSection) {
        await Section.updateOne(
          { _id: student.currentSection, currentStrength: { $gt: 0 } },
          { $inc: { currentStrength: -1 } },
          { session }
        );
      }
      if (payload.currentSection) {
        const newSection = await Section.findById(payload.currentSection).session(session);
        if (!newSection || !newSection.isActive) throw new AppError('Valid active section not found', 404);
        if (newSection.currentStrength >= newSection.maxStrength) {
          throw new AppError('Target section has reached maximum capacity', 409);
        }
        newSection.currentStrength += 1;
        await newSection.save({ session });
      }
    }

    const userFields = {};
    for (const f of ['firstName', 'lastName', 'phone']) {
      if (payload[f] !== undefined) userFields[f] = payload[f];
    }
    if (Object.keys(userFields).length > 0) {
      await User.updateOne({ _id: student.user }, { $set: userFields }, { session });
    }

    const stuFields = [
      'department', 'program', 'currentSection', 'currentSemester', 'currentYear',
      'status', 'graduationDate', 'presentAddress', 'permanentAddress', 'guardian',
    ];
    for (const f of stuFields) {
      if (payload[f] !== undefined) student[f] = payload[f];
    }
    await student.save({ session });

    return populateStudent(Student.findById(student._id).session(session));
  });
};

const updateMyProfile = async (caller, payload) => {
  if (!caller.studentProfile) throw new AppError('No student profile linked to this account', 404);

  return runInTransaction(async (session) => {
    const student = await Student.findById(caller.studentProfile).session(session);
    if (!student) throw new AppError('Student profile not found', 404);

    const userFields = {};
    if (payload.phone !== undefined)          userFields.phone = payload.phone;
    if (payload.profilePicture !== undefined) userFields.profilePicture = payload.profilePicture;
    if (Object.keys(userFields).length > 0) {
      await User.updateOne({ _id: student.user }, { $set: userFields }, { session });
    }

    for (const f of ['bloodGroup', 'motherTongue', 'presentAddress', 'permanentAddress', 'guardian']) {
      if (payload[f] !== undefined) student[f] = payload[f];
    }
    await student.save({ session });

    return populateStudent(Student.findById(student._id).session(session));
  });
};

const deleteStudent = async (id, actorId) => {
  return runInTransaction(async (session) => {
    const student = await Student.findById(id).session(session);
    if (!student) throw new AppError('Student record not found', 404);

    if (student.currentSection) {
      await Section.updateOne(
        { _id: student.currentSection, currentStrength: { $gt: 0 } },
        { $inc: { currentStrength: -1 } },
        { session }
      );
    }

    student.isDeleted = true;
    student.deletedAt = new Date();
    student.status    = 'withdrawn';
    await student.save({ session });

    await User.updateOne(
      { _id: student.user },
      { $set: { isDeleted: true, deletedAt: new Date(), deletedBy: actorId, status: 'inactive', refreshTokens: [] }, $inc: { tokenVersion: 1 } },
      { session }
    );
  });
};

const getAcademicHistory = async (studentId, caller) => {
  if (caller.role === 'student' && String(caller.studentProfile) !== String(studentId)) {
    throw new AppError('You can only view your own academic history.', 403);
  }

  const student = await populateStudent(Student.findById(studentId));
  if (!student) throw new AppError('Student record not found', 404);

  const resultFilter = { student: student._id };
  if (caller.role === 'student') resultFilter.isPublished = true;

  const [enrollments, results] = await Promise.all([
    Enrollment.find({ student: student._id })
      .populate('course', 'name code credits type semesterNumber')
      .populate('semester', 'name type startDate endDate')
      .populate('academicYear', 'name')
      .populate('section', 'name')
      .sort({ createdAt: 1 })
      .lean(),
    Result.find(resultFilter)
      .populate('semester', 'name type semesterNumber')
      .populate('academicYear', 'name')
      .populate('courseResults.course', 'name code credits')
      .sort({ createdAt: 1 })
      .lean(),
  ]);

  return {
    student: {
      id                    : student._id,
      rollNumber            : student.rollNumber,
      enrollmentNumber      : student.enrollmentNumber,
      department            : student.department,
      program               : student.program,
      batchYear             : student.batchYear,
      currentSemester       : student.currentSemester,
      currentYear           : student.currentYear,
      currentSection        : student.currentSection,
      status                : student.status,
      cgpa                  : student.cgpa,
      totalCreditsEarned    : student.totalCreditsEarned,
      previousQualifications: student.previousQualifications,
    },
    enrollments,
    semesterResults: results,
  };
};

module.exports = {
  listStudents,
  getStudentById,
  getMyProfile,
  createStudent,
  updateStudent,
  updateMyProfile,
  deleteStudent,
  getAcademicHistory,
};

