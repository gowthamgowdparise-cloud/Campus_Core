'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./assessment.controller');
const schemas  = require('./assessment.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.ASSESSMENTS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.ASSESSMENTS_READ), ctrl.getById);

router.post(
  '/',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ASSESSMENTS_MANAGE),
  validate(schemas.create),
  auditLogger('ASSESSMENT_CREATE', 'assessments', { entityType: 'Assessment' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ASSESSMENTS_MANAGE),
  validate(schemas.update),
  auditLogger('ASSESSMENT_UPDATE', 'assessments', { entityType: 'Assessment', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ASSESSMENTS_MANAGE),
  auditLogger('ASSESSMENT_CANCEL', 'assessments', { entityType: 'Assessment', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

