'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./examination.controller');
const schemas  = require('./examination.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.EXAMINATIONS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.EXAMINATIONS_READ), ctrl.getById);

router.post(
  '/',
  authorize('admin'),
  requirePermission(PERMISSIONS.EXAMINATIONS_MANAGE),
  validate(schemas.create),
  auditLogger('EXAMINATION_CREATE', 'examinations', { entityType: 'Examination' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.EXAMINATIONS_MANAGE),
  validate(schemas.update),
  auditLogger('EXAMINATION_UPDATE', 'examinations', { entityType: 'Examination', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.patch(
  '/:id/schedule',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.EXAMINATIONS_MANAGE),
  validate(schemas.updateSchedule),
  auditLogger('EXAMINATION_SCHEDULE_UPDATE', 'examinations', { entityType: 'Examination', getEntityId: (req) => req.params.id }),
  ctrl.updateSchedule
);

router.patch(
  '/:id/status',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.EXAMINATIONS_MANAGE),
  validate(schemas.updateStatus),
  auditLogger('EXAMINATION_STATUS_UPDATE', 'examinations', { entityType: 'Examination', getEntityId: (req) => req.params.id }),
  ctrl.updateStatus
);

module.exports = router;

