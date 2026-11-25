'use strict';

const { verifyAccessToken } = require('../modules/auth/auth.tokens');
const User    = require('../modules/users/user.model');
const AppError = require('../utils/AppError');
const { getPermissionsForRole } = require('../config/permissions');

/**
 * authenticate – verifies the JWT access token and attaches req.user.
 * Never trusts role or userId supplied in request bodies.
 *
 * Token must be in:
 *   Authorization: Bearer <token>
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(new AppError('Authentication required. Please provide a valid access token.', 401));
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      return next(new AppError('Authentication required. Please provide a valid access token.', 401));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return next(new AppError('Access token has expired. Please refresh your session.', 401));
      }
      return next(new AppError('Invalid access token.', 401));
    }

    if (decoded.type !== 'access') {
      return next(new AppError('Invalid token type.', 401));
    }

    // Fetch user (validate active, not soft-deleted)
    const user = await User.findById(decoded.sub);
    if (!user) {
      return next(new AppError('User no longer exists.', 401));
    }

    if (user.status !== 'active') {
      return next(new AppError(`Account is ${user.status}. Access denied.`, 403));
    }

    // Detect session invalidation (logout-all / password change)
    if (typeof decoded.tv === 'number' && decoded.tv !== (user.tokenVersion || 0)) {
      return next(new AppError('Session has been invalidated. Please login again.', 401));
    }

    // Detect password change after token issuance
    if (user.isTokenIssuedBefore(decoded.iat)) {
      return next(new AppError('Password was changed. Please login again.', 401));
    }

    // Attach trusted user context derived solely from verified JWT + DB record
    req.user = {
      id                : user._id.toString(),
      email             : user.email,
      firstName         : user.firstName,
      lastName          : user.lastName,
      fullName          : user.fullName,
      role              : user.role,
      permissions       : getPermissionsForRole(user.role),
      status            : user.status,
      mustChangePassword: user.mustChangePassword,
      studentProfile    : user.studentProfile,
      facultyProfile    : user.facultyProfile,
    };

    next();
  } catch (err) {
    next(err);
  }
};

module.exports = { authenticate };
