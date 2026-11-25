'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./timetable.controller');
const schemas  = require('./timetable.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/me', requirePermission(PERMISSIONS.TIMETABLES_READ), ctrl.getMine);
router.get('/', requirePermission(PERMISSIONS.TIMETABLES_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.TIMETABLES_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.TIMETABLES_MANAGE),
  validate(schemas.create),
  auditLogger('TIMETABLE_CREATE', 'timetables', { entityType: 'Timetable' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.TIMETABLES_MANAGE),
  validate(schemas.update),
  auditLogger('TIMETABLE_UPDATE', 'timetables', { entityType: 'Timetable', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.patch(
  '/:id/publish',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.TIMETABLES_MANAGE),
  auditLogger('TIMETABLE_PUBLISH', 'timetables', { entityType: 'Timetable', getEntityId: (req) => req.params.id }),
  ctrl.publish
);

module.exports = router;

