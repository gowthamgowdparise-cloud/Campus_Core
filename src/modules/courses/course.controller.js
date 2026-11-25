'use strict';

const courseService = require('./course.service');
const catchAsync    = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { courses, meta } = await courseService.listCourses(req.query, req.user);
  sendSuccess(res, 200, 'Courses retrieved successfully', courses, meta);
});

const getById = catchAsync(async (req, res) => {
  const course = await courseService.getCourseById(req.params.id);
  sendSuccess(res, 200, 'Course retrieved successfully', course);
});

const create = catchAsync(async (req, res) => {
  const course = await courseService.createCourse(req.body);
  sendSuccess(res, 201, 'Course created successfully', course);
});

const update = catchAsync(async (req, res) => {
  const course = await courseService.updateCourse(req.params.id, req.body);
  sendSuccess(res, 200, 'Course updated successfully', course);
});

const remove = catchAsync(async (req, res) => {
  await courseService.deleteCourse(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Course deleted successfully');
});

const listAssignments = catchAsync(async (req, res) => {
  const { assignments, meta } = await courseService.listAssignments(req.query, req.user);
  sendSuccess(res, 200, 'Course assignments retrieved successfully', assignments, meta);
});

const createAssignment = catchAsync(async (req, res) => {
  const assignment = await courseService.createAssignment(req.body, req.user.id);
  sendSuccess(res, 201, 'Faculty assigned to course successfully', assignment);
});

const removeAssignment = catchAsync(async (req, res) => {
  await courseService.removeAssignment(req.params.assignmentId);
  sendSuccess(res, 200, 'Course assignment deactivated successfully');
});

const listMaterials = catchAsync(async (req, res) => {
  const { materials, meta } = await courseService.listMaterials(req.params.courseId, req.query, req.user);
  sendSuccess(res, 200, 'Course materials retrieved successfully', materials, meta);
});

const createMaterial = catchAsync(async (req, res) => {
  const material = await courseService.createMaterial(req.params.courseId, req.body, req.validatedFile, req.user);
  sendSuccess(res, 201, 'Course material uploaded successfully', material);
});

const downloadMaterial = catchAsync(async (req, res) => {
  const result = await courseService.downloadMaterial(req.params.materialId, req.user);
  if (result.mode === 'presigned_url') {
    return sendSuccess(res, 200, 'Presigned download URL generated', {
      downloadUrl: result.url,
      expiresIn  : result.expiresIn,
      fileName   : result.fileName,
    });
  }

  const safeName = (result.fileName || 'material').replace(/["\\\r\n]/g, '_');
  res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  result.stream.pipe(res);
});

const updateMaterial = catchAsync(async (req, res) => {
  const material = await courseService.updateMaterial(req.params.materialId, req.body, req.user);
  sendSuccess(res, 200, 'Course material updated successfully', material);
});

const deleteMaterial = catchAsync(async (req, res) => {
  await courseService.deleteMaterial(req.params.materialId, req.user);
  sendSuccess(res, 200, 'Course material deleted successfully');
});

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  listAssignments,
  createAssignment,
  removeAssignment,
  listMaterials,
  createMaterial,
  downloadMaterial,
  updateMaterial,
  deleteMaterial,
};

