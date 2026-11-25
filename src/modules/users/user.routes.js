'use strict';

const express = require('express');
const router  = express.Router();
const ctrl    = require('./user.controller');
const schemas = require('./user.validators');
const validate = require('../../middleware/validate');
const { authenticate } = require('../../middleware/authenticate');
const { requirePermission, requireOwnerOrAdmin } = require('../../middleware/authorize');
const { auditLogger }  = require('../../middleware/auditLogger');
const { PERMISSIONS }  = require('../../config/permissions');
const { idParamSchema } = require('../../validators');

router.use(authenticate);

router.get(
  '/roles/permissions',
  requirePermission(PERMISSIONS.ROLES_READ),
  ctrl.getRolesAndPermissions
);

router.get(
  '/',
  requirePermission(PERMISSIONS.USERS_READ),
  validate(schemas.listUsersQuery, 'query'),
  ctrl.listUsers
);

router.post(
  '/',
  requirePermission(PERMISSIONS.USERS_CREATE),
  validate(schemas.createUser),
  auditLogger('USER_CREATE', 'users', { entityType: 'User' }),
  ctrl.createUser
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  requireOwnerOrAdmin((req) => req.params.id),
  ctrl.getUser
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requireOwnerOrAdmin((req) => req.params.id),
  validate(schemas.updateUser),
  auditLogger('USER_UPDATE', 'users', { entityType: 'User', getEntityId: (req) => req.params.id }),
  ctrl.updateUser
);

router.patch(
  '/:id/status',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(schemas.updateStatus),
  auditLogger('USER_STATUS_CHANGE', 'users', { entityType: 'User', getEntityId: (req) => req.params.id }),
  ctrl.updateUserStatus
);

router.patch(
  '/:id/role',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.USERS_UPDATE),
  validate(schemas.updateRole),
  auditLogger('USER_ROLE_CHANGE', 'users', { entityType: 'User', getEntityId: (req) => req.params.id }),
  ctrl.updateUserRole
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.USERS_DELETE),
  auditLogger('USER_DELETE', 'users', { entityType: 'User', getEntityId: (req) => req.params.id }),
  ctrl.deleteUser
);

module.exports = router;

