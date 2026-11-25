'use strict';

const User     = require('./user.model');
const AppError = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, parseSort, buildSearchFilter } = require('../../utils/queryHelpers');
const { PERMISSIONS, ROLE_PERMISSIONS, getPermissionsForRole } = require('../../config/permissions');

const ALLOWED_SORT = ['createdAt', 'firstName', 'lastName', 'email', 'role', 'status'];

const listUsers = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const sort = parseSort(query.sort, ALLOWED_SORT);

  const filter = {};
  if (query.role)   filter.role = query.role;
  if (query.status) filter.status = query.status;

  const searchFilter = buildSearchFilter(query.search, ['firstName', 'lastName', 'email']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [users, total] = await Promise.all([
    User.find(filter)
      .select('firstName lastName email phone gender role status mustChangePassword lastLoginAt studentProfile facultyProfile createdAt')
      .sort(sort)
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter),
  ]);

  return { users, meta: buildPaginationMeta({ page, limit, total }) };
};

const getUserById = async (id) => {
  const user = await User.findById(id)
    .populate('studentProfile', 'rollNumber enrollmentNumber currentSemester status department program')
    .populate('facultyProfile', 'employeeId designation department isHOD status');

  if (!user) throw new AppError('User not found', 404);
  return user;
};

const createUser = async (payload) => {
  const email = payload.email.toLowerCase();
  const existing = await User.findOne({ email }).setOptions({ includeDeleted: true });
  if (existing) {
    throw new AppError(`A user with email "${email}" already exists.`, 409);
  }

  const user = await User.create({
    firstName         : payload.firstName,
    lastName          : payload.lastName,
    email,
    passwordHash      : payload.password,
    role              : payload.role,
    phone             : payload.phone,
    gender            : payload.gender,
    dateOfBirth       : payload.dateOfBirth,
    status            : payload.status || 'active',
    mustChangePassword: payload.mustChangePassword ?? true,
  });

  return user;
};

const updateUser = async (id, payload, actor) => {
  const user = await User.findById(id);
  if (!user) throw new AppError('User not found', 404);

  const allowedSelf = ['firstName', 'lastName', 'phone', 'gender', 'dateOfBirth', 'profilePicture'];
  const allowedFields = actor.role === 'admin'
    ? [...allowedSelf, 'mustChangePassword']
    : allowedSelf;

  // Reject any attempt by a non-admin to pass restricted fields
  if (actor.role !== 'admin' && payload.mustChangePassword !== undefined) {
    throw new AppError('You do not have permission to modify account security flags.', 403);
  }

  for (const field of allowedFields) {
    if (payload[field] !== undefined) {
      user[field] = payload[field];
    }
  }

  await user.save();
  return user;
};

const updateUserStatus = async (id, status, actorId) => {
  if (id === actorId) {
    throw new AppError('Administrators cannot change their own account status.', 400);
  }

  const user = await User.findById(id).select('+refreshTokens');
  if (!user) throw new AppError('User not found', 404);

  user.status = status;
  if (status !== 'active') {
    user.revokeAllRefreshTokens();
  }
  await user.save();
  return user;
};

const updateUserRole = async (id, role, actorId) => {
  if (id === actorId) {
    throw new AppError('Administrators cannot change their own role.', 400);
  }

  const user = await User.findById(id).select('+refreshTokens');
  if (!user) throw new AppError('User not found', 404);

  user.role = role;
  user.revokeAllRefreshTokens();
  await user.save();
  return user;
};

const deleteUser = async (id, actorId) => {
  if (id === actorId) {
    throw new AppError('Administrators cannot delete their own account.', 400);
  }

  const user = await User.findById(id).select('+refreshTokens');
  if (!user) throw new AppError('User not found', 404);

  user.isDeleted = true;
  user.deletedAt = new Date();
  user.deletedBy = actorId;
  user.status    = 'inactive';
  user.revokeAllRefreshTokens();
  await user.save();
};

const getRolePermissionsInfo = (callerRole) => {
  if (callerRole === 'admin') {
    return {
      currentRole   : callerRole,
      permissions   : getPermissionsForRole(callerRole),
      roleMatrix    : ROLE_PERMISSIONS,
      allPermissions: PERMISSIONS,
    };
  }
  return {
    currentRole: callerRole,
    permissions: getPermissionsForRole(callerRole),
  };
};

module.exports = {
  listUsers,
  getUserById,
  createUser,
  updateUser,
  updateUserStatus,
  updateUserRole,
  deleteUser,
  getRolePermissionsInfo,
};

