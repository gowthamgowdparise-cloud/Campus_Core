'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./department.controller');
const schemas  = require('./department.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.DEPARTMENTS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.DEPARTMENTS_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validate(schemas.create),
  auditLogger('DEPARTMENT_CREATE', 'departments', { entityType: 'Department' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validate(schemas.update),
  auditLogger('DEPARTMENT_UPDATE', 'departments', { entityType: 'Department', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.patch(
  '/:id/hod',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  validate(schemas.assignHod),
  auditLogger('DEPARTMENT_HOD_ASSIGN', 'departments', { entityType: 'Department', getEntityId: (req) => req.params.id }),
  ctrl.assignHod
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.DEPARTMENTS_MANAGE),
  auditLogger('DEPARTMENT_DELETE', 'departments', { entityType: 'Department', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

