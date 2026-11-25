'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./grievance.controller');
const schemas  = require('./grievance.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.GRIEVANCES_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.GRIEVANCES_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.GRIEVANCES_CREATE),
  validate(schemas.create),
  auditLogger('GRIEVANCE_CREATE', 'grievances', { entityType: 'Grievance' }),
  ctrl.create
);

router.post(
  '/:id/comments',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.GRIEVANCES_READ),
  validate(schemas.addComment),
  auditLogger('GRIEVANCE_COMMENT_ADD', 'grievances', { entityType: 'Grievance', getEntityId: (req) => req.params.id }),
  ctrl.addComment
);

router.patch(
  '/:id/assign',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.GRIEVANCES_MANAGE),
  validate(schemas.assign),
  auditLogger('GRIEVANCE_ASSIGN', 'grievances', { entityType: 'Grievance', getEntityId: (req) => req.params.id }),
  ctrl.assign
);

router.patch(
  '/:id/status',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  validate(schemas.updateStatus),
  auditLogger('GRIEVANCE_STATUS_UPDATE', 'grievances', { entityType: 'Grievance', getEntityId: (req) => req.params.id }),
  ctrl.updateStatus
);

module.exports = router;

