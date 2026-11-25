'use strict';

const ayService       = require('./academicYear.service');
const catchAsync      = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { academicYears, meta } = await ayService.listAcademicYears(req.query);
  sendSuccess(res, 200, 'Academic years retrieved successfully', academicYears, meta);
});

const getCurrent = catchAsync(async (_req, res) => {
  const ay = await ayService.getCurrentAcademicYear();
  sendSuccess(res, 200, 'Current academic year retrieved successfully', ay);
});

const getById = catchAsync(async (req, res) => {
  const ay = await ayService.getAcademicYearById(req.params.id);
  sendSuccess(res, 200, 'Academic year retrieved successfully', ay);
});

const create = catchAsync(async (req, res) => {
  const ay = await ayService.createAcademicYear(req.body);
  sendSuccess(res, 201, 'Academic year created successfully', ay);
});

const update = catchAsync(async (req, res) => {
  const ay = await ayService.updateAcademicYear(req.params.id, req.body);
  sendSuccess(res, 200, 'Academic year updated successfully', ay);
});

const remove = catchAsync(async (req, res) => {
  await ayService.deleteAcademicYear(req.params.id);
  sendSuccess(res, 200, 'Academic year deleted successfully');
});

const listCalendar = catchAsync(async (req, res) => {
  const { events, meta } = await ayService.listCalendarEvents(req.query, req.user.role);
  sendSuccess(res, 200, 'Academic calendar events retrieved successfully', events, meta);
});

const createCalendarEvent = catchAsync(async (req, res) => {
  const ev = await ayService.createCalendarEvent(req.body, req.user.id);
  sendSuccess(res, 201, 'Academic calendar event created successfully', ev);
});

const updateCalendarEvent = catchAsync(async (req, res) => {
  const ev = await ayService.updateCalendarEvent(req.params.eventId, req.body);
  sendSuccess(res, 200, 'Academic calendar event updated successfully', ev);
});

const deleteCalendarEvent = catchAsync(async (req, res) => {
  await ayService.deleteCalendarEvent(req.params.eventId, req.user.id);
  sendSuccess(res, 200, 'Academic calendar event deleted successfully');
});

module.exports = {
  list,
  getCurrent,
  getById,
  create,
  update,
  remove,
  listCalendar,
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
};

