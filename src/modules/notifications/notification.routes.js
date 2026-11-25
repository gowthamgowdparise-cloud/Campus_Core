'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./notification.controller');
const schemas  = require('./notification.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/me', requirePermission(PERMISSIONS.NOTIFICATIONS_READ), validate(schemas.listQuery, 'query'), ctrl.getMine);
router.get('/me/unread-count', requirePermission(PERMISSIONS.NOTIFICATIONS_READ), ctrl.getUnreadCount);
router.patch('/me/read-all', requirePermission(PERMISSIONS.NOTIFICATIONS_READ), ctrl.markAllRead);
router.patch('/me/:id/read', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.NOTIFICATIONS_READ), ctrl.markRead);

router.post(
  '/',
  authorize('admin'),
  requirePermission(PERMISSIONS.NOTIFICATIONS_MANAGE),
  validate(schemas.createBulk),
  auditLogger('NOTIFICATION_DISPATCH', 'notifications', { entityType: 'Notification' }),
  ctrl.sendBulk
);

module.exports = router;

