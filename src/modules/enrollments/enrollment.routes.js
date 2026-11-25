'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./enrollment.controller');
const schemas  = require('./enrollment.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/me', authorize('student'), requirePermission(PERMISSIONS.ENROLLMENTS_READ), validate(schemas.listQuery, 'query'), ctrl.getMine);
router.get('/', requirePermission(PERMISSIONS.ENROLLMENTS_READ), validate(schemas.listQuery, 'query'), ctrl.list);

router.post(
  '/',
  authorize('admin', 'student'),
  validate(schemas.create),
  auditLogger('ENROLLMENT_CREATE', 'enrollments', { entityType: 'Enrollment' }),
  ctrl.create
);

router.post(
  '/bulk',
  authorize('admin'),
  requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE),
  validate(schemas.bulkEnroll),
  auditLogger('ENROLLMENT_BULK_CREATE', 'enrollments', { entityType: 'Enrollment' }),
  ctrl.bulkCreate
);

router.patch(
  '/:id/drop',
  validate(idParamSchema, 'params'),
  authorize('admin', 'student'),
  validate(schemas.drop),
  auditLogger('ENROLLMENT_DROP', 'enrollments', { entityType: 'Enrollment', getEntityId: (req) => req.params.id }),
  ctrl.drop
);

router.patch(
  '/:id/status',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.ENROLLMENTS_MANAGE),
  validate(schemas.updateStatus),
  auditLogger('ENROLLMENT_STATUS_UPDATE', 'enrollments', { entityType: 'Enrollment', getEntityId: (req) => req.params.id }),
  ctrl.updateStatus
);

module.exports = router;

