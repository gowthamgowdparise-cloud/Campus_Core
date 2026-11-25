'use strict';

const resultService = require('./result.service');
const catchAsync    = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { results, meta } = await resultService.listResults(req.query, req.user);
  sendSuccess(res, 200, 'Results retrieved successfully', results, meta);
});

const getMine = catchAsync(async (req, res) => {
  const results = await resultService.getStudentResults(req.user.studentProfile, req.user);
  sendSuccess(res, 200, 'My results retrieved successfully', results);
});

const getMyBacklogs = catchAsync(async (req, res) => {
  const backlogs = await resultService.getBacklogs(req.user.studentProfile, req.user);
  sendSuccess(res, 200, 'My backlog records retrieved successfully', backlogs);
});

const getBacklogs = catchAsync(async (req, res) => {
  const backlogs = await resultService.getBacklogs(req.query.student || null, req.user);
  sendSuccess(res, 200, 'Backlog records retrieved successfully', backlogs);
});

const getByStudent = catchAsync(async (req, res) => {
  const results = await resultService.getStudentResults(req.params.studentId, req.user);
  sendSuccess(res, 200, 'Student results retrieved successfully', results);
});

const generate = catchAsync(async (req, res) => {
  const result = await resultService.generateResult(req.body, req.user);
  sendSuccess(res, 201, 'Semester result generated successfully', result);
});

const publish = catchAsync(async (req, res) => {
  const result = await resultService.publishResult(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Result published successfully', result);
});

const classPerformance = catchAsync(async (req, res) => {
  const report = await resultService.getClassPerformanceReport(req.query, req.user);
  sendSuccess(res, 200, 'Class performance report generated successfully', report);
});

module.exports = {
  list,
  getMine,
  getMyBacklogs,
  getBacklogs,
  getByStudent,
  generate,
  publish,
  classPerformance,
};

