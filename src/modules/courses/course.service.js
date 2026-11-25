'use strict';

const Course           = require('./course.model');
const CourseAssignment = require('./courseAssignment.model');
const CourseMaterial   = require('./courseMaterial.model');
const Department       = require('../departments/department.model');
const Program          = require('../programs/program.model');
const Faculty          = require('../faculty/faculty.model');
const Section          = require('../sections/section.model');
const Semester         = require('../semesters/semester.model');
const AcademicYear     = require('../academic-years/academicYear.model');
const Enrollment       = require('../enrollments/enrollment.model');
const AppError         = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');
const { generateStorageKey } = require('../../middleware/upload');
const { getStorageProvider } = require('../../services/storage');

const ALLOWED_SORT = ['code', 'name', 'semesterNumber', 'credits', 'createdAt'];

const listCourses = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT, { code: 1 });

  const filter = {};
  if (query.department)           filter.department = query.department;
  if (query.program)              filter.program = query.program;
  if (query.semesterNumber)       filter.semesterNumber = Number(query.semesterNumber);
  if (query.type)                 filter.type = query.type;
  if (query.category)             filter.category = query.category;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  // Faculty may view courses they are assigned to unless querying general catalog;
  // Student may filter by enrolled if requested or read program courses.
  if (query.assignedOnly === 'true' && caller.role === 'faculty') {
    const courseIds = await CourseAssignment.find({
      faculty : caller.facultyProfile,
      isActive: true,
    }).distinct('course');
    filter._id = { $in: courseIds };
  }

  const searchFilter = buildSearchFilter(query.search, ['name', 'code', 'shortName']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [courses, total] = await Promise.all([
    Course.find(filter)
      .populate('department', 'name code')
      .populate('program', 'name code shortName')
      .populate('prerequisites', 'name code')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    Course.countDocuments(filter),
  ]);

  return { courses, meta: buildPaginationMeta({ page, limit, total }) };
};

const getCourseById = async (id) => {
  const course = await Course.findById(id)
    .populate('department', 'name code')
    .populate('program', 'name code shortName')
    .populate('prerequisites', 'name code credits');
  if (!course) throw new AppError('Course not found', 404);
  return course;
};

const createCourse = async (payload) => {
  const [dept, prog] = await Promise.all([
    Department.findById(payload.department),
    Program.findById(payload.program),
  ]);
  if (!dept || !dept.isActive) throw new AppError('Valid active department is required', 404);
  if (!prog || !prog.isActive) throw new AppError('Valid active program is required', 404);
  if (String(prog.department) !== String(dept._id)) {
    throw new AppError('Program does not belong to the specified department', 400);
  }
  if (payload.prerequisites && payload.prerequisites.length > 0) {
    const count = await Course.countDocuments({ _id: { $in: payload.prerequisites } });
    if (count !== payload.prerequisites.length) {
      throw new AppError('One or more prerequisite courses do not exist', 404);
    }
  }
  return Course.create(payload);
};

const updateCourse = async (id, payload) => {
  const course = await Course.findById(id);
  if (!course) throw new AppError('Course not found', 404);

  if (payload.prerequisites) {
    if (payload.prerequisites.includes(id)) {
      throw new AppError('A course cannot be a prerequisite of itself', 400);
    }
    const count = await Course.countDocuments({ _id: { $in: payload.prerequisites } });
    if (count !== payload.prerequisites.length) {
      throw new AppError('One or more prerequisite courses do not exist', 404);
    }
  }

  Object.assign(course, payload);
  await course.save();
  return course;
};

const deleteCourse = async (id, actorId) => {
  const course = await Course.findById(id);
  if (!course) throw new AppError('Course not found', 404);

  const enrollments = await Enrollment.countDocuments({ course: id, status: 'enrolled' });
  if (enrollments > 0) {
    throw new AppError('Cannot delete course with active student enrollments', 409);
  }

  course.isDeleted = true;
  course.deletedAt = new Date();
  course.deletedBy = actorId;
  course.isActive  = false;
  await course.save();
};

// ── Faculty-Course Assignments ─────────────────────────────────────────────
const listAssignments = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.course)       filter.course = query.course;
  if (query.section)      filter.section = query.section;
  if (query.semester)     filter.semester = query.semester;
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  if (caller.role === 'faculty') {
    if (!caller.facultyProfile) throw new AppError('Faculty profile not linked', 403);
    filter.faculty = caller.facultyProfile;
  } else if (query.faculty) {
    filter.faculty = query.faculty;
  }

  const [assignments, total] = await Promise.all([
    CourseAssignment.find(filter)
      .populate({
        path    : 'faculty',
        select  : 'employeeId designation user department',
        populate: { path: 'user', select: 'firstName lastName email' },
      })
      .populate('course', 'name code credits type semesterNumber')
      .populate('section', 'name year semesterNumber')
      .populate('semester', 'name type isCurrent')
      .populate('academicYear', 'name isCurrent')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CourseAssignment.countDocuments(filter),
  ]);

  return { assignments, meta: buildPaginationMeta({ page, limit, total }) };
};

const createAssignment = async (payload, actorId) => {
  const [faculty, course, section, semester, academicYear] = await Promise.all([
    Faculty.findById(payload.faculty),
    Course.findById(payload.course),
    Section.findById(payload.section),
    Semester.findById(payload.semester),
    AcademicYear.findById(payload.academicYear),
  ]);

  if (!faculty || faculty.status !== 'active') throw new AppError('Active faculty profile not found', 404);
  if (!course  || !course.isActive)            throw new AppError('Active course not found', 404);
  if (!section || !section.isActive)           throw new AppError('Active section not found', 404);
  if (!semester)                               throw new AppError('Semester not found', 404);
  if (!academicYear)                           throw new AppError('Academic year not found', 404);

  if (String(section.academicYear) !== String(academicYear._id) || String(section.semester) !== String(semester._id)) {
    throw new AppError('Section does not belong to the specified semester and academic year', 400);
  }

  if (String(course.program) !== String(section.program)) {
    throw new AppError('Course program does not match section program', 400);
  }

  const assignment = await CourseAssignment.create({ ...payload, assignedBy: actorId });

  // Sync primary instructor onto active enrollments in this section+course+semester if unset
  if (assignment.role === 'primary') {
    await Enrollment.updateMany(
      { course: course._id, section: section._id, semester: semester._id, faculty: null },
      { $set: { faculty: faculty._id } }
    );
  }

  return assignment;
};

const removeAssignment = async (assignmentId) => {
  const assignment = await CourseAssignment.findById(assignmentId);
  if (!assignment) throw new AppError('Course assignment not found', 404);
  assignment.isActive = false;
  await assignment.save();
};

// ── Course Materials ───────────────────────────────────────────────────────
const assertCourseMaterialAccess = async (courseId, caller, semesterId = null, sectionId = null) => {
  if (caller.role === 'admin') return;

  if (caller.role === 'faculty') {
    const query = {
      faculty : caller.facultyProfile,
      course  : courseId,
      isActive: true,
    };
    if (semesterId) query.semester = semesterId;
    if (sectionId)  query.section  = sectionId;

    const assigned = await CourseAssignment.exists(query);
    if (!assigned) {
      throw new AppError('You are not assigned to this course/section.', 403);
    }
    return;
  }

  if (caller.role === 'student') {
    const enrollFilter = {
      student: caller.studentProfile,
      course : courseId,
      status : { $in: ['enrolled', 'completed'] },
    };
    if (semesterId) enrollFilter.semester = semesterId;
    const enrolled = await Enrollment.exists(enrollFilter);
    if (!enrolled) {
      throw new AppError('You are not enrolled in this course.', 403);
    }
    return;
  }

  throw new AppError('Access denied', 403);
};

const listMaterials = async (courseId, query, caller) => {
  const course = await Course.findById(courseId);
  if (!course) throw new AppError('Course not found', 404);

  await assertCourseMaterialAccess(courseId, caller, query.semester, query.section);

  const { page, limit, skip } = parsePagination(query);
  const filter = { course: courseId };
  if (query.section)      filter.section = query.section;
  if (query.semester)     filter.semester = query.semester;
  if (query.materialType) filter.materialType = query.materialType;
  if (caller.role === 'student') filter.isPublished = true;

  const searchFilter = buildSearchFilter(query.search, ['title', 'description', 'fileName']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [materials, total] = await Promise.all([
    CourseMaterial.find(filter)
      .populate({
        path    : 'faculty',
        select  : 'employeeId user',
        populate: { path: 'user', select: 'firstName lastName' },
      })
      .populate('section', 'name')
      .populate('semester', 'name')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    CourseMaterial.countDocuments(filter),
  ]);

  return { materials, meta: buildPaginationMeta({ page, limit, total }) };
};

const createMaterial = async (courseId, payload, uploadedFile, caller) => {
  if (!uploadedFile) {
    throw new AppError('A valid file upload in multipart field "file" is required.', 400);
  }

  const course = await Course.findById(courseId);
  if (!course) throw new AppError('Course not found', 404);

  if (caller.role === 'faculty') {
    await assertCourseMaterialAccess(courseId, caller, payload.semester, payload.section || null);
  }

  let facultyId = caller.facultyProfile;
  if (!facultyId && caller.role === 'admin') {
    const assignment = await CourseAssignment.findOne({
      course  : courseId,
      semester: payload.semester,
      isActive: true,
    });
    if (!assignment) {
      throw new AppError('Assign a faculty instructor to this course before adding material', 400);
    }
    facultyId = assignment.faculty;
  }

  const storageProvider = getStorageProvider();
  const storageKey      = generateStorageKey('course-materials', courseId, uploadedFile.ext);
  const stored          = await storageProvider.putObject({
    key        : storageKey,
    buffer     : uploadedFile.buffer,
    contentType: uploadedFile.mimeType,
    metadata   : { courseId: String(courseId), uploadedBy: String(caller.id) },
  });

  try {
    return await CourseMaterial.create({
      ...payload,
      course         : courseId,
      faculty        : facultyId,
      uploadedBy     : caller.id,
      fileName       : uploadedFile.cleanName,
      fileUrlOrPath  : stored.location,
      storageProvider: stored.provider,
      storageKey     : stored.key,
      mimeType       : uploadedFile.mimeType,
      fileSize       : uploadedFile.size,
      fileHash       : uploadedFile.fileHash,
    });
  } catch (err) {
    await storageProvider.deleteObject(stored.key).catch(() => {});
    throw err;
  }
};

const downloadMaterial = async (materialId, caller) => {
  const material = await CourseMaterial.findById(materialId);
  if (!material) throw new AppError('Course material not found', 404);

  if (caller.role === 'student' && !material.isPublished) {
    throw new AppError('This course material is not published.', 403);
  }

  await assertCourseMaterialAccess(material.course, caller, material.semester, material.section || null);

  if (!material.storageKey || material.storageProvider === 'external') {
    throw new AppError('Course material has no managed binary file stored', 404);
  }

  const provider = getStorageProvider(material.storageProvider);
  if (provider.providerName === 's3') {
    const signed = await provider.getSignedDownloadUrl(material.storageKey, { downloadName: material.fileName });
    return { ...signed, fileName: material.fileName, mimeType: material.mimeType };
  }

  const streamObj = await provider.getObjectStream(material.storageKey);
  return { ...streamObj, fileName: material.fileName, mimeType: material.mimeType };
};

const updateMaterial = async (materialId, payload, caller) => {
  const material = await CourseMaterial.findById(materialId);
  if (!material) throw new AppError('Course material not found', 404);

  if (caller.role === 'faculty' && String(material.faculty) !== String(caller.facultyProfile)) {
    throw new AppError('You can only modify course materials you uploaded.', 403);
  }

  Object.assign(material, payload);
  await material.save();
  return material;
};

const deleteMaterial = async (materialId, caller) => {
  const material = await CourseMaterial.findById(materialId);
  if (!material) throw new AppError('Course material not found', 404);

  if (caller.role === 'faculty' && String(material.faculty) !== String(caller.facultyProfile)) {
    throw new AppError('You can only delete course materials you uploaded.', 403);
  }

  material.isDeleted = true;
  material.deletedAt = new Date();
  material.deletedBy = caller.id;
  await material.save();

  if (material.storageKey && material.storageProvider !== 'external') {
    await getStorageProvider(material.storageProvider).deleteObject(material.storageKey).catch(() => {});
  }
};

module.exports = {
  listCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
  listAssignments,
  createAssignment,
  removeAssignment,
  listMaterials,
  createMaterial,
  downloadMaterial,
  updateMaterial,
  deleteMaterial,
};

