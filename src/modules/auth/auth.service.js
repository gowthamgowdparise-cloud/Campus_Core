'use strict';

const User = require('../users/user.model');
// Ensure referenced schemas are registered before .populate() in getMe()
require('../students/student.model');
require('../faculty/faculty.model');
require('../departments/department.model');
require('../programs/program.model');
require('../academic-years/academicYear.model');
require('../sections/section.model');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('./auth.tokens');
const AppError = require('../../utils/AppError');
const logger   = require('../../utils/logger');
const { getPermissionsForRole } = require('../../config/permissions');
const { recordSecurityAudit }   = require('../../middleware/auditLogger');

/**
 * Login a user (any role) with email + password.
 */
const login = async ({ email, password, userAgent, ipAddress }) => {
  // 1. Find user (include passwordHash and refreshTokens)
  const user = await User.findOne({ email: email.toLowerCase() })
    .select('+passwordHash +refreshTokens');

  if (!user) throw new AppError('Invalid credentials', 401);

  // 2. Verify password BEFORE revealing account status
  const isMatch = await user.verifyPassword(password);
  if (!isMatch) throw new AppError('Invalid credentials', 401);

  // 3. Check account status consistently (blocks suspended, inactive, pending_verification)
  if (user.status === 'suspended') {
    throw new AppError('Your account has been suspended. Please contact administration.', 403);
  }
  if (user.status === 'inactive') {
    throw new AppError('Your account is inactive. Please contact administration.', 403);
  }
  if (user.status === 'pending_verification') {
    throw new AppError('Your account is pending verification. Please complete verification first.', 403);
  }
  if (user.status !== 'active') {
    throw new AppError('Your account is not active. Please contact administration.', 403);
  }

  // 4. Generate tokens
  const accessToken = generateAccessToken({
    userId      : user._id,
    role        : user.role,
    tokenVersion: user.tokenVersion || 0,
  });
  const refreshData = generateRefreshToken({
    userId      : user._id,
    role        : user.role,
    tokenVersion: user.tokenVersion || 0,
  });

  // 5. Store hashed refresh token
  user.addRefreshToken({
    token    : refreshData.token,
    family   : refreshData.family,
    expiresAt: refreshData.expiresAt,
    userAgent,
    ipAddress,
  });

  // 6. Update last login
  user.lastLoginAt = new Date();
  user.lastLoginIp = ipAddress;
  await user.save();

  logger.info(`Login success: ${user.email} [${user.role}]`);

  return {
    accessToken,
    refreshToken: refreshData.token,
    user: {
      id                : user._id,
      email             : user.email,
      firstName         : user.firstName,
      lastName          : user.lastName,
      fullName          : user.fullName,
      role              : user.role,
      permissions       : getPermissionsForRole(user.role),
      status            : user.status,
      mustChangePassword: user.mustChangePassword,
    },
  };
};

/**
 * Rotate a refresh token (silent re-auth).
 * Implements token family rotation with reuse detection.
 */
const refreshTokens = async ({ refreshToken, userAgent, ipAddress }) => {
  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch {
    throw new AppError('Invalid or expired refresh token', 401);
  }

  if (decoded.type !== 'refresh') {
    throw new AppError('Invalid token type', 401);
  }

  const user = await User.findById(decoded.sub).select('+refreshTokens');
  if (!user) throw new AppError('User not found', 401);

  if (user.status !== 'active') {
    throw new AppError('Account is not active', 403);
  }

  if (typeof decoded.tv === 'number' && decoded.tv !== (user.tokenVersion || 0)) {
    throw new AppError('Session has been invalidated. Please login again.', 401);
  }

  if (user.isTokenIssuedBefore(decoded.iat)) {
    throw new AppError('Password was changed. Please login again.', 401);
  }

  // Check if active token exists in the user's store
  const storedToken = user.findRefreshToken(refreshToken);

  // Reuse detection: if token is NOT active, but its family still exists -> revoke entire family
  if (!storedToken) {
    const familyToken = user.refreshTokens.find((rt) => rt.family === decoded.family);
    if (familyToken) {
      user.revokeTokenFamily(decoded.family);
      await user.save();
      logger.warn(`Refresh token reuse detected for user ${user.email} – family revoked`);
      recordSecurityAudit({
        actor     : user._id,
        actorRole : user.role,
        actorEmail: user.email,
        action    : 'REFRESH_TOKEN_REUSE_DETECTED',
        module    : 'auth',
        method    : 'POST',
        endpoint  : '/api/v1/auth/refresh',
        entityType: 'User',
        entityId  : user._id,
        ipAddress,
        userAgent,
        statusCode: 401,
        status    : 'failure',
        after     : { revokedFamily: decoded.family },
      });
    }
    throw new AppError('Refresh token has been revoked. Please login again.', 401);
  }

  // Revoke old token
  user.revokeRefreshToken(refreshToken);

  // Issue new pair under the same token family
  const newAccess = generateAccessToken({
    userId      : user._id,
    role        : user.role,
    tokenVersion: user.tokenVersion || 0,
  });
  const newRefresh = generateRefreshToken({
    userId      : user._id,
    role        : user.role,
    family      : decoded.family,
    tokenVersion: user.tokenVersion || 0,
  });

  user.addRefreshToken({
    token    : newRefresh.token,
    family   : newRefresh.family,
    expiresAt: newRefresh.expiresAt,
    userAgent,
    ipAddress,
  });

  await user.save();

  return { accessToken: newAccess, refreshToken: newRefresh.token };
};

/**
 * Logout – revoke the supplied refresh token.
 */
const logout = async ({ userId, refreshToken }) => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  user.revokeRefreshToken(refreshToken);
  await user.save();
  logger.info(`Logout: ${user.email}`);
};

/**
 * Logout from all devices – revoke all refresh tokens.
 */
const logoutAll = async (userId) => {
  const user = await User.findById(userId).select('+refreshTokens');
  if (!user) return;
  user.revokeAllRefreshTokens();
  await user.save();
  logger.info(`All sessions revoked: ${user.email}`);
};

/**
 * Change password (authenticated user).
 */
const changePassword = async ({ userId, currentPassword, newPassword }) => {
  const user = await User.findById(userId).select('+passwordHash +refreshTokens');
  if (!user) throw new AppError('User not found', 404);

  const isMatch = await user.verifyPassword(currentPassword);
  if (!isMatch) throw new AppError('Current password is incorrect', 400);

  if (currentPassword === newPassword) {
    throw new AppError('New password must differ from current password', 400);
  }

  user.passwordHash       = newPassword; // pre-save hook hashes it and updates passwordChangedAt
  user.mustChangePassword = false;
  user.revokeAllRefreshTokens(); // force re-login on all devices
  await user.save();

  logger.info(`Password changed: ${user.email}`);
};

/**
 * Fetch the authenticated user's profile with populated role-specific references.
 */
const getMe = async (userId) => {
  const user = await User.findById(userId)
    .populate({
      path    : 'studentProfile',
      populate: [
        { path: 'department',     select: 'name code' },
        { path: 'program',        select: 'name code shortName type' },
        { path: 'academicYear',   select: 'name isCurrent' },
        { path: 'currentSection', select: 'name year semesterNumber' },
      ],
    })
    .populate({
      path    : 'facultyProfile',
      populate: [
        { path: 'department',     select: 'name code' },
        { path: 'classTeacherOf', select: 'name year semesterNumber' },
      ],
    });

  if (!user) throw new AppError('User not found', 404);

  return {
    id                : user._id.toString(),
    email             : user.email,
    firstName         : user.firstName,
    lastName          : user.lastName,
    fullName          : user.fullName,
    role              : user.role,
    permissions       : getPermissionsForRole(user.role),
    status            : user.status,
    mustChangePassword: user.mustChangePassword,
    lastLoginAt       : user.lastLoginAt,
    studentProfile    : user.studentProfile,
    facultyProfile    : user.facultyProfile,
  };
};

module.exports = { login, refreshTokens, logout, logoutAll, changePassword, getMe };
