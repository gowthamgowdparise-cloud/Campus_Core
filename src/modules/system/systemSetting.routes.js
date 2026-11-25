'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./systemSetting.controller');
const schemas  = require('./systemSetting.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');

router.use(authenticate);

// Authenticated users can read public institutional configuration (e.g., grading/attendance thresholds)
router.get('/public', ctrl.getPublic);

// Admin only management
router.get('/', authorize('admin'), requirePermission(PERMISSIONS.SETTINGS_MANAGE), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:key', validate(schemas.keyParam, 'params'), authorize('admin'), requirePermission(PERMISSIONS.SETTINGS_MANAGE), ctrl.getByKey);

router.post(
  '/',
  authorize('admin'),
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(schemas.upsert),
  auditLogger('SETTING_UPSERT', 'system', { entityType: 'SystemSetting' }),
  ctrl.upsert
);

router.put(
  '/:key',
  validate(schemas.keyParam, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(schemas.updateByKey),
  auditLogger('SETTING_UPDATE', 'system', { entityType: 'SystemSetting' }),
  ctrl.updateByKey
);

module.exports = router;

