'use strict';

const timetableService = require('./timetable.service');
const catchAsync       = require('../../utils/catchAsync');
const { sendSuccess }  = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { timetables, meta } = await timetableService.listTimetables(req.query, req.user);
  sendSuccess(res, 200, 'Timetables retrieved successfully', timetables, meta);
});

const getMine = catchAsync(async (req, res) => {
  const data = await timetableService.getMyTimetable(req.user, req.query);
  sendSuccess(res, 200, 'Timetable retrieved successfully', data);
});

const getById = catchAsync(async (req, res) => {
  const tt = await timetableService.getTimetableById(req.params.id, req.user);
  sendSuccess(res, 200, 'Timetable retrieved successfully', tt);
});

const create = catchAsync(async (req, res) => {
  const tt = await timetableService.createTimetable(req.body, req.user.id);
  sendSuccess(res, 201, 'Timetable created successfully', tt);
});

const update = catchAsync(async (req, res) => {
  const tt = await timetableService.updateTimetable(req.params.id, req.body);
  sendSuccess(res, 200, 'Timetable updated successfully', tt);
});

const publish = catchAsync(async (req, res) => {
  const tt = await timetableService.publishTimetable(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Timetable published successfully', tt);
});

module.exports = { list, getMine, getById, create, update, publish };

