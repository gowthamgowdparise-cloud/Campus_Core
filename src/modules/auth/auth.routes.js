'use strict';

const express           = require('express');
const router            = express.Router();
const ctrl              = require('./auth.controller');
const { authenticate }  = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { PERMISSIONS }   = require('../../config/permissions');
const validate          = require('../../middleware/validate');
const schemas           = require('./auth.validators');
const authRateLimit     = require('../../middleware/authRateLimit');
const { auditLogger }   = require('../../middleware/auditLogger');

// Public routes (rate-limited)
router.post(
  '/login',
  authRateLimit,
  validate(schemas.login),
  auditLogger('USER_LOGIN', 'auth', { logAnonymous: true, entityType: 'User' }),
  ctrl.login
);
router.post(
  '/refresh',
  authRateLimit,
  validate(schemas.refreshToken),
  ctrl.refresh
);

// Protected routes
router.use(authenticate);
router.get(
  '/me',
  requirePermission(PERMISSIONS.AUTH_READ_SELF),
  ctrl.getMe
);
router.post(
  '/logout',
  validate(schemas.logout),
  auditLogger('USER_LOGOUT', 'auth', { entityType: 'User' }),
  ctrl.logout
);
router.post(
  '/logout-all',
  auditLogger('USER_LOGOUT_ALL', 'auth', { entityType: 'User' }),
  ctrl.logoutAll
);
router.patch(
  '/change-password',
  authRateLimit,
  requirePermission(PERMISSIONS.AUTH_CHANGE_PASSWORD),
  validate(schemas.changePassword),
  auditLogger('PASSWORD_CHANGED', 'auth', { entityType: 'User' }),
  ctrl.changePassword
);

module.exports = router;
