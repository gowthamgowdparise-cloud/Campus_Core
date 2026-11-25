'use strict';

const userService = require('./user.service');
const catchAsync  = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const listUsers = catchAsync(async (req, res) => {
  const { users, meta } = await userService.listUsers(req.query);
  sendSuccess(res, 200, 'Users retrieved successfully', users, meta);
});

const getUser = catchAsync(async (req, res) => {
  const user = await userService.getUserById(req.params.id);
  sendSuccess(res, 200, 'User retrieved successfully', user);
});

const createUser = catchAsync(async (req, res) => {
  const user = await userService.createUser(req.body);
  sendSuccess(res, 201, 'User created successfully', user);
});

const updateUser = catchAsync(async (req, res) => {
  const user = await userService.updateUser(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'User updated successfully', user);
});

const updateUserStatus = catchAsync(async (req, res) => {
  const user = await userService.updateUserStatus(req.params.id, req.body.status, req.user.id);
  sendSuccess(res, 200, 'User status updated successfully', user);
});

const updateUserRole = catchAsync(async (req, res) => {
  const user = await userService.updateUserRole(req.params.id, req.body.role, req.user.id);
  sendSuccess(res, 200, 'User role updated successfully', user);
});

const deleteUser = catchAsync(async (req, res) => {
  await userService.deleteUser(req.params.id, req.user.id);
  sendSuccess(res, 200, 'User deleted successfully');
});

const getRolesAndPermissions = catchAsync(async (req, res) => {
  const info = userService.getRolePermissionsInfo(req.user.role);
  sendSuccess(res, 200, 'Roles and permissions retrieved successfully', info);
});

module.exports = {
  listUsers,
  getUser,
  createUser,
  updateUser,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getRolesAndPermissions,
};

