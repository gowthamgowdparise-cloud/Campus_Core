'use strict';

const jwt    = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { config }     = require('../../config');

/**
 * Generate a signed JWT access token.
 * @param {{ userId, role }} payload
 * @returns {string}
 */
const generateAccessToken = (payload) => {
  return jwt.sign(
    {
      sub : payload.userId.toString(),
      role: payload.role,
      type: 'access',
      tv  : payload.tokenVersion ?? 0,
      jti : uuidv4(),
    },
    config.jwt.accessSecret,
    { expiresIn: config.jwt.accessExpiresIn, issuer: 'campuscore' }
  );
};

/**
 * Generate a signed JWT refresh token with a family ID for rotation tracking.
 * @param {{ userId, role, family?, tokenVersion? }} payload
 * @returns {{ token: string, family: string, expiresAt: Date }}
 */
const generateRefreshToken = (payload) => {
  const family = payload.family || uuidv4();
  const expiresIn = config.jwt.refreshExpiresIn; // "7d"

  const token = jwt.sign(
    {
      sub   : payload.userId.toString(),
      role  : payload.role,
      family,
      type  : 'refresh',
      tv    : payload.tokenVersion ?? 0,
      jti   : uuidv4(),
    },
    config.jwt.refreshSecret,
    { expiresIn, issuer: 'campuscore' }
  );

  // Parse expiry into a Date for storage
  const decoded = jwt.decode(token);
  const expiresAt = new Date(decoded.exp * 1000);

  return { token, family, expiresAt };
};

/**
 * Verify and decode a JWT access token.
 * @param {string} token
 * @returns {object} decoded payload
 * @throws {jwt.JsonWebTokenError|jwt.TokenExpiredError}
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, config.jwt.accessSecret, { issuer: 'campuscore' });
};

/**
 * Verify and decode a JWT refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, config.jwt.refreshSecret, { issuer: 'campuscore' });
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
};

