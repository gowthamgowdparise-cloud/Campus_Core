'use strict';

const examService   = require('./examination.service');
const catchAsync    = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { examinations, meta } = await examService.listExaminations(req.query, req.user);
  sendSuccess(res, 200, 'Examinations retrieved successfully', examinations, meta);
});

const getById = catchAsync(async (req, res) => {
  const exam = await examService.getExaminationById(req.params.id, req.user);
  sendSuccess(res, 200, 'Examination retrieved successfully', exam);
});

const create = catchAsync(async (req, res) => {
  const exam = await examService.createExamination(req.body, req.user.id);
  sendSuccess(res, 201, 'Examination scheduled successfully', exam);
});

const update = catchAsync(async (req, res) => {
  const exam = await examService.updateExamination(req.params.id, req.body);
  sendSuccess(res, 200, 'Examination updated successfully', exam);
});

const updateSchedule = catchAsync(async (req, res) => {
  const exam = await examService.updateExaminationSchedule(req.params.id, req.body.examSchedule);
  sendSuccess(res, 200, 'Examination schedule updated successfully', exam);
});

const updateStatus = catchAsync(async (req, res) => {
  const exam = await examService.updateExaminationStatus(req.params.id, req.body.status, req.user.id);
  sendSuccess(res, 200, 'Examination status updated successfully', exam);
});

module.exports = { list, getById, create, update, updateSchedule, updateStatus };

