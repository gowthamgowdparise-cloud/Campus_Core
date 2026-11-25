'use strict';

const marksService  = require('./marks.service');
const catchAsync    = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { marks, meta } = await marksService.listMarks(req.query, req.user);
  sendSuccess(res, 200, 'Marks retrieved successfully', marks, meta);
});

const getMine = catchAsync(async (req, res) => {
  const { marks, meta } = await marksService.listMarks(req.query, req.user);
  sendSuccess(res, 200, 'My marks retrieved successfully', marks, meta);
});

const createSingle = catchAsync(async (req, res) => {
  const mark = await marksService.enterMarks(req.body, req.user);
  sendSuccess(res, 201, 'Marks saved successfully', mark);
});

const createBulk = catchAsync(async (req, res) => {
  const marks = await marksService.enterBulkMarks(req.body.entries, req.user);
  sendSuccess(res, 201, 'Bulk marks saved successfully', marks);
});

const update = catchAsync(async (req, res) => {
  const mark = await marksService.updateMarks(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'Marks updated successfully', mark);
});

const submit = catchAsync(async (req, res) => {
  const marks = await marksService.submitMarks(req.body.markIds, req.user);
  sendSuccess(res, 200, 'Marks submitted for approval', marks);
});

const approveSingle = catchAsync(async (req, res) => {
  const [mark] = await marksService.reviewMarksApproval([req.params.id], req.body, req.user.id);
  sendSuccess(res, 200, `Marks ${req.body.decision}`, mark);
});

const approveBulk = catchAsync(async (req, res) => {
  const marks = await marksService.reviewMarksApproval(req.body.markIds, req.body, req.user.id);
  sendSuccess(res, 200, `Marks batch ${req.body.decision}`, marks);
});

const createCorrection = catchAsync(async (req, res) => {
  const doc = await marksService.createCorrectionRequest(req.body, req.user);
  sendSuccess(res, 201, 'Marks correction request submitted', doc);
});

const listCorrections = catchAsync(async (req, res) => {
  const { requests, meta } = await marksService.listCorrectionRequests(req.query, req.user);
  sendSuccess(res, 200, 'Marks correction requests retrieved', requests, meta);
});

const reviewCorrection = catchAsync(async (req, res) => {
  const doc = await marksService.reviewCorrectionRequest(req.params.id, req.body, req.user);
  sendSuccess(res, 200, `Marks correction request ${req.body.decision}`, doc);
});

module.exports = {
  list,
  getMine,
  createSingle,
  createBulk,
  update,
  submit,
  approveSingle,
  approveBulk,
  createCorrection,
  listCorrections,
  reviewCorrection,
};

