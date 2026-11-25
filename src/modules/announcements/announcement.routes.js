'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./announcement.controller');
const schemas  = require('./announcement.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission, requireAnyPermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.ANNOUNCEMENTS_READ), validate(schemas.listQuery, 'query'), ctrl.list);

router.post(
  '/',
  authorize('admin', 'faculty'),
  requireAnyPermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE, PERMISSIONS.ANNOUNCEMENTS_CREATE),
  validate(schemas.create),
  auditLogger('ANNOUNCEMENT_CREATE', 'announcements', { entityType: 'Announcement' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requireAnyPermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE, PERMISSIONS.ANNOUNCEMENTS_CREATE),
  validate(schemas.update),
  auditLogger('ANNOUNCEMENT_UPDATE', 'announcements', { entityType: 'Announcement', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requireAnyPermission(PERMISSIONS.ANNOUNCEMENTS_MANAGE, PERMISSIONS.ANNOUNCEMENTS_CREATE),
  auditLogger('ANNOUNCEMENT_DELETE', 'announcements', { entityType: 'Announcement', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

