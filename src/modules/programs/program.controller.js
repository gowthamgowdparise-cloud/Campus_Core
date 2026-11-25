'use strict';

const programService = require('./program.service');
const catchAsync     = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { programs, meta } = await programService.listPrograms(req.query);
  sendSuccess(res, 200, 'Programs retrieved successfully', programs, meta);
});

const getById = catchAsync(async (req, res) => {
  const program = await programService.getProgramById(req.params.id);
  sendSuccess(res, 200, 'Program retrieved successfully', program);
});

const create = catchAsync(async (req, res) => {
  const program = await programService.createProgram(req.body);
  sendSuccess(res, 201, 'Program created successfully', program);
});

const update = catchAsync(async (req, res) => {
  const program = await programService.updateProgram(req.params.id, req.body);
  sendSuccess(res, 200, 'Program updated successfully', program);
});

const remove = catchAsync(async (req, res) => {
  await programService.deleteProgram(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Program deleted successfully');
});

module.exports = { list, getById, create, update, remove };

