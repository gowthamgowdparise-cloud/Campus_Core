'use strict';

const feeService    = require('./fee.service');
const catchAsync    = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const listStructures = catchAsync(async (req, res) => {
  const { structures, meta } = await feeService.listStructures(req.query, req.user);
  sendSuccess(res, 200, 'Fee structures retrieved successfully', structures, meta);
});

const getStructure = catchAsync(async (req, res) => {
  const data = await feeService.getStructureById(req.params.id, req.user);
  sendSuccess(res, 200, 'Fee structure retrieved successfully', data);
});

const createStructure = catchAsync(async (req, res) => {
  const data = await feeService.createStructure(req.body, req.user.id);
  sendSuccess(res, 201, 'Fee structure created successfully', data);
});

const updateStructure = catchAsync(async (req, res) => {
  const data = await feeService.updateStructure(req.params.id, req.body);
  sendSuccess(res, 200, 'Fee structure updated successfully', data);
});

const listRecords = catchAsync(async (req, res) => {
  const { records, meta } = await feeService.listRecords(req.query, req.user);
  sendSuccess(res, 200, 'Fee records retrieved successfully', records, meta);
});

const getMyFees = catchAsync(async (req, res) => {
  const data = await feeService.getMyFees(req.user);
  sendSuccess(res, 200, 'My fee dues retrieved successfully', data);
});

const getRecord = catchAsync(async (req, res) => {
  const data = await feeService.getRecordById(req.params.id, req.user);
  sendSuccess(res, 200, 'Fee record retrieved successfully', data);
});

const assignFees = catchAsync(async (req, res) => {
  const data = await feeService.assignFees(req.body, req.user.id);
  sendSuccess(res, 201, 'Fees assigned successfully', data);
});

const updateConcession = catchAsync(async (req, res) => {
  const data = await feeService.updateConcession(req.params.id, req.body);
  sendSuccess(res, 200, 'Fee record updated successfully', data);
});

const applyLateFines = catchAsync(async (req, res) => {
  const data = await feeService.applyOverdueLateFines(req.body);
  sendSuccess(res, 200, 'Overdue late fines evaluated and applied', data);
});

module.exports = {
  listStructures,
  getStructure,
  createStructure,
  updateStructure,
  listRecords,
  getMyFees,
  getRecord,
  assignFees,
  updateConcession,
  applyLateFines,
};

