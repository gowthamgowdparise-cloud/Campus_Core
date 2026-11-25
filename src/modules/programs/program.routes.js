'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./program.controller');
const schemas  = require('./program.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.PROGRAMS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.PROGRAMS_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.PROGRAMS_MANAGE),
  validate(schemas.create),
  auditLogger('PROGRAM_CREATE', 'programs', { entityType: 'Program' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.PROGRAMS_MANAGE),
  validate(schemas.update),
  auditLogger('PROGRAM_UPDATE', 'programs', { entityType: 'Program', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.PROGRAMS_MANAGE),
  auditLogger('PROGRAM_DELETE', 'programs', { entityType: 'Program', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

