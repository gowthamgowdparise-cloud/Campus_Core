'use strict';

const sectionService = require('./section.service');
const catchAsync     = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { sections, meta } = await sectionService.listSections(req.query, req.user);
  sendSuccess(res, 200, 'Sections retrieved successfully', sections, meta);
});

const getById = catchAsync(async (req, res) => {
  const section = await sectionService.getSectionById(req.params.id, req.user);
  sendSuccess(res, 200, 'Section retrieved successfully', section);
});

const create = catchAsync(async (req, res) => {
  const section = await sectionService.createSection(req.body);
  sendSuccess(res, 201, 'Section created successfully', section);
});

const update = catchAsync(async (req, res) => {
  const section = await sectionService.updateSection(req.params.id, req.body);
  sendSuccess(res, 200, 'Section updated successfully', section);
});

const assignClassTeacher = catchAsync(async (req, res) => {
  const section = await sectionService.assignClassTeacher(req.params.id, req.body.facultyId);
  sendSuccess(res, 200, 'Class teacher assigned successfully', section);
});

module.exports = { list, getById, create, update, assignClassTeacher };

