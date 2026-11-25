'use strict';

const AppError = require('../utils/AppError');
const { hasAllPermissions, hasAnyPermission } = require('../config/permissions');

/**
 * authorize – Role-Based Access Control middleware factory.
 *
 * Usage:
 *   router.get('/admin-only', authenticate, authorize('admin'), handler);
 *   router.get('/staff',      authenticate, authorize('admin', 'faculty'), handler);
 *
 * @param {...string} allowedRoles  One or more role names.
 */
const authorize = (...allowedRoles) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (!allowedRoles.includes(req.user.role)) {
    return next(
      new AppError(
        `Access denied. Required role(s): [${allowedRoles.join(', ')}]. Your role: ${req.user.role}`,
        403
      )
    );
  }

  next();
};

/**
 * requirePermission – Fine-grained permission-based authorization middleware.
 * Ensures the authenticated user's role grants ALL specified permissions.
 *
 * @param {...string} requiredPermissions
 */
const requirePermission = (...requiredPermissions) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (!hasAllPermissions(req.user.role, requiredPermissions)) {
    return next(
      new AppError(
        `Access denied. Missing required permission(s): [${requiredPermissions.join(', ')}]`,
        403
      )
    );
  }

  next();
};

/**
 * requireAnyPermission – Grants access if the user's role has at least one listed permission.
 *
 * @param {...string} candidatePermissions
 */
const requireAnyPermission = (...candidatePermissions) => (req, res, next) => {
  if (!req.user) {
    return next(new AppError('Authentication required.', 401));
  }

  if (!hasAnyPermission(req.user.role, candidatePermissions)) {
    return next(
      new AppError(
        `Access denied. Requires one of: [${candidatePermissions.join(', ')}]`,
        403
      )
    );
  }

  next();
};

/**
 * requireOwnerOrAdmin – ensures the caller is accessing their own resource or is an admin.
 *
 * @param {Function} getOwnerId  Function (req) => string|ObjectId – derives owner id from request.
 */
const requireOwnerOrAdmin = (getOwnerId) => (req, res, next) => {
  if (!req.user) return next(new AppError('Authentication required.', 401));

  if (req.user.role === 'admin') return next();

  const ownerId = getOwnerId(req)?.toString();
  if (ownerId && ownerId === req.user.id) return next();

  return next(new AppError('You do not have permission to access this resource.', 403));
};

module.exports = {
  authorize,
  requirePermission,
  requireAnyPermission,
  requireOwnerOrAdmin,
};
