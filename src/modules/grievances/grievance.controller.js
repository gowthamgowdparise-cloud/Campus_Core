'use strict';

const grievanceService = require('./grievance.service');
const catchAsync       = require('../../utils/catchAsync');
const { sendSuccess }  = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { grievances, meta } = await grievanceService.listGrievances(req.query, req.user);
  sendSuccess(res, 200, 'Grievances retrieved successfully', grievances, meta);
});

const getById = catchAsync(async (req, res) => {
  const doc = await grievanceService.getGrievanceById(req.params.id, req.user);
  sendSuccess(res, 200, 'Grievance retrieved successfully', doc);
});

const create = catchAsync(async (req, res) => {
  const doc = await grievanceService.createGrievance(req.body, req.user);
  sendSuccess(res, 201, 'Grievance submitted successfully', doc);
});

const addComment = catchAsync(async (req, res) => {
  const doc = await grievanceService.addComment(req.params.id, req.body, req.user);
  sendSuccess(res, 201, 'Comment added to grievance', doc);
});

const assign = catchAsync(async (req, res) => {
  const doc = await grievanceService.assignGrievance(req.params.id, req.body.assignedTo);
  sendSuccess(res, 200, 'Grievance assigned successfully', doc);
});

const updateStatus = catchAsync(async (req, res) => {
  const doc = await grievanceService.updateStatus(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'Grievance status updated successfully', doc);
});

module.exports = { list, getById, create, addComment, assign, updateStatus };

