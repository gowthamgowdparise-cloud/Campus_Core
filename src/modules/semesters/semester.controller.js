'use strict';

const semesterService = require('./semester.service');
const catchAsync      = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { semesters, meta } = await semesterService.listSemesters(req.query);
  sendSuccess(res, 200, 'Semesters retrieved successfully', semesters, meta);
});

const getCurrent = catchAsync(async (_req, res) => {
  const sem = await semesterService.getCurrentSemester();
  sendSuccess(res, 200, 'Current semester retrieved successfully', sem);
});

const getById = catchAsync(async (req, res) => {
  const sem = await semesterService.getSemesterById(req.params.id);
  sendSuccess(res, 200, 'Semester retrieved successfully', sem);
});

const create = catchAsync(async (req, res) => {
  const sem = await semesterService.createSemester(req.body);
  sendSuccess(res, 201, 'Semester created successfully', sem);
});

const update = catchAsync(async (req, res) => {
  const sem = await semesterService.updateSemester(req.params.id, req.body);
  sendSuccess(res, 200, 'Semester updated successfully', sem);
});

module.exports = { list, getCurrent, getById, create, update };

