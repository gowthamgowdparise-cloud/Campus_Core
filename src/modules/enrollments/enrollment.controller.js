'use strict';

const enrollmentService = require('./enrollment.service');
const catchAsync        = require('../../utils/catchAsync');
const { sendSuccess }   = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { enrollments, meta } = await enrollmentService.listEnrollments(req.query, req.user);
  sendSuccess(res, 200, 'Enrollments retrieved successfully', enrollments, meta);
});

const getMine = catchAsync(async (req, res) => {
  const { enrollments, meta } = await enrollmentService.listEnrollments(req.query, req.user);
  sendSuccess(res, 200, 'My enrollments retrieved successfully', enrollments, meta);
});

const create = catchAsync(async (req, res) => {
  const enrollment = await enrollmentService.createEnrollment(req.body, req.user);
  sendSuccess(res, 201, 'Enrollment completed successfully', enrollment);
});

const bulkCreate = catchAsync(async (req, res) => {
  const enrollments = await enrollmentService.bulkEnroll(req.body);
  sendSuccess(res, 201, 'Bulk enrollment completed successfully', enrollments);
});

const drop = catchAsync(async (req, res) => {
  const enrollment = await enrollmentService.dropEnrollment(req.params.id, req.body.dropReason, req.user);
  sendSuccess(res, 200, 'Course dropped successfully', enrollment);
});

const updateStatus = catchAsync(async (req, res) => {
  const enrollment = await enrollmentService.updateEnrollmentStatus(req.params.id, req.body);
  sendSuccess(res, 200, 'Enrollment updated successfully', enrollment);
});

module.exports = { list, getMine, create, bulkCreate, drop, updateStatus };

