'use strict';

const assessmentService = require('./assessment.service');
const catchAsync        = require('../../utils/catchAsync');
const { sendSuccess }   = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { assessments, meta } = await assessmentService.listAssessments(req.query, req.user);
  sendSuccess(res, 200, 'Assessments retrieved successfully', assessments, meta);
});

const getById = catchAsync(async (req, res) => {
  const assessment = await assessmentService.getAssessmentById(req.params.id, req.user);
  sendSuccess(res, 200, 'Assessment retrieved successfully', assessment);
});

const create = catchAsync(async (req, res) => {
  const assessment = await assessmentService.createAssessment(req.body, req.user);
  sendSuccess(res, 201, 'Assessment created successfully', assessment);
});

const update = catchAsync(async (req, res) => {
  const assessment = await assessmentService.updateAssessment(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'Assessment updated successfully', assessment);
});

const remove = catchAsync(async (req, res) => {
  await assessmentService.deleteAssessment(req.params.id, req.user);
  sendSuccess(res, 200, 'Assessment cancelled successfully');
});

module.exports = { list, getById, create, update, remove };

