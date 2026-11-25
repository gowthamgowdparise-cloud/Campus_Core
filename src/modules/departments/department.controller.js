'use strict';

const departmentService = require('./department.service');
const catchAsync        = require('../../utils/catchAsync');
const { sendSuccess }   = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { departments, meta } = await departmentService.listDepartments(req.query);
  sendSuccess(res, 200, 'Departments retrieved successfully', departments, meta);
});

const getById = catchAsync(async (req, res) => {
  const dept = await departmentService.getDepartmentById(req.params.id);
  sendSuccess(res, 200, 'Department retrieved successfully', dept);
});

const create = catchAsync(async (req, res) => {
  const dept = await departmentService.createDepartment(req.body);
  sendSuccess(res, 201, 'Department created successfully', dept);
});

const update = catchAsync(async (req, res) => {
  const dept = await departmentService.updateDepartment(req.params.id, req.body);
  sendSuccess(res, 200, 'Department updated successfully', dept);
});

const assignHod = catchAsync(async (req, res) => {
  const dept = await departmentService.assignDepartmentHod(req.params.id, req.body.hodId);
  sendSuccess(res, 200, 'Department HOD updated successfully', dept);
});

const remove = catchAsync(async (req, res) => {
  await departmentService.deleteDepartment(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Department deleted successfully');
});

module.exports = { list, getById, create, update, assignHod, remove };

