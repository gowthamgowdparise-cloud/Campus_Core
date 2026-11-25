'use strict';

const authService       = require('./auth.service');
const catchAsync        = require('../../utils/catchAsync');
const AppError          = require('../../utils/AppError');
const { sendSuccess }   = require('../../utils/apiResponse');
const { config }        = require('../../config');

const DEFAULT_REFRESH_MS = 7 * 24 * 60 * 60 * 1000;

/** Parse duration strings like "7d", "15m", "12h", "60s" into milliseconds. */
const parseDurationMs = (value) => {
  if (!value) return DEFAULT_REFRESH_MS;
  const match = String(value).trim().match(/^(\d+)([smhd])$/i);
  if (!match) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric > 0 ? numeric * 1000 : DEFAULT_REFRESH_MS;
  }
  const amount = Number(match[1]);
  const unit   = match[2].toLowerCase();
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return amount * multipliers[unit];
};

/** Build consistent cookie options for setting and clearing refresh tokens. */
const getRefreshCookieOptions = (includeMaxAge = true) => {
  const opts = {
    httpOnly: true,
    secure  : config.app.env === 'production',
    sameSite: 'strict',
  };
  if (includeMaxAge) {
    opts.maxAge = parseDurationMs(config.jwt.refreshExpiresIn);
  }
  return opts;
};

/**
 * POST /api/v1/auth/login
 */
const login = catchAsync(async (req, res) => {
  const { email, password } = req.body;
  const userAgent = req.headers['user-agent'] || '';
  const ipAddress = req.ip;

  const result = await authService.login({ email, password, userAgent, ipAddress });

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions(true));

  sendSuccess(res, 200, 'Login successful', {
    accessToken: result.accessToken,
    user       : result.user,
  });
});

/**
 * POST /api/v1/auth/refresh
 * Accepts token from httpOnly cookie OR body (for mobile clients).
 */
const refresh = catchAsync(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    throw new AppError('Refresh token required', 401);
  }

  const result = await authService.refreshTokens({
    refreshToken,
    userAgent: req.headers['user-agent'] || '',
    ipAddress: req.ip,
  });

  res.cookie('refreshToken', result.refreshToken, getRefreshCookieOptions(true));

  sendSuccess(res, 200, 'Token refreshed', { accessToken: result.accessToken });
});

/**
 * POST /api/v1/auth/logout
 */
const logout = catchAsync(async (req, res) => {
  const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
  if (!refreshToken) {
    throw new AppError('Refresh token required', 400);
  }

  await authService.logout({ userId: req.user.id, refreshToken });
  res.clearCookie('refreshToken', getRefreshCookieOptions(false));
  sendSuccess(res, 200, 'Logged out successfully');
});

/**
 * POST /api/v1/auth/logout-all
 */
const logoutAll = catchAsync(async (req, res) => {
  await authService.logoutAll(req.user.id);
  res.clearCookie('refreshToken', getRefreshCookieOptions(false));
  sendSuccess(res, 200, 'All sessions revoked');
});

/**
 * PATCH /api/v1/auth/change-password
 */
const changePassword = catchAsync(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  await authService.changePassword({
    userId: req.user.id,
    currentPassword,
    newPassword,
  });
  res.clearCookie('refreshToken', getRefreshCookieOptions(false));
  sendSuccess(res, 200, 'Password changed successfully. Please login again.');
});

/**
 * GET /api/v1/auth/me
 */
const getMe = catchAsync(async (req, res) => {
  const profile = await authService.getMe(req.user.id);
  sendSuccess(res, 200, 'Current user', profile);
});

module.exports = { login, refresh, logout, logoutAll, changePassword, getMe };
