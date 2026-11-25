'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./payment.controller');
const schemas  = require('./payment.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission, requireAnyPermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

// Public signed provider webhook endpoint (verified via raw-body HMAC signature)
router.post(
  '/webhooks/:provider',
  validate(schemas.webhookParams, 'params'),
  ctrl.webhook
);

router.use(authenticate);

router.get('/me', authorize('student'), requirePermission(PERMISSIONS.PAYMENTS_READ_OWN), validate(schemas.listQuery, 'query'), ctrl.getMine);

router.get(
  '/reconciliation/summary',
  authorize('admin'),
  requirePermission(PERMISSIONS.PAYMENTS_RECONCILE),
  ctrl.reconciliationSummary
);

router.get(
  '/',
  requireAnyPermission(PERMISSIONS.PAYMENTS_MANAGE, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(schemas.listQuery, 'query'),
  ctrl.list
);

router.post(
  '/initiate',
  authorize('admin', 'student'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_MANAGE, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(schemas.initiate),
  auditLogger('PAYMENT_PROVIDER_INITIATE', 'payments', { entityType: 'Payment' }),
  ctrl.initiate
);

router.post(
  '/',
  authorize('admin', 'student'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_MANAGE, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(schemas.create),
  auditLogger('PAYMENT_CREATE', 'payments', { entityType: 'Payment' }),
  ctrl.create
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_MANAGE, PERMISSIONS.PAYMENTS_READ_OWN),
  ctrl.getById
);

router.get(
  '/:id/receipt',
  validate(idParamSchema, 'params'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_MANAGE, PERMISSIONS.PAYMENTS_READ_OWN),
  ctrl.getReceipt
);

router.post(
  '/:id/verify',
  validate(idParamSchema, 'params'),
  authorize('admin', 'student'),
  requireAnyPermission(PERMISSIONS.PAYMENTS_MANAGE, PERMISSIONS.PAYMENTS_READ_OWN),
  validate(schemas.verify),
  auditLogger('PAYMENT_PROVIDER_VERIFIED', 'payments', { entityType: 'Payment', getEntityId: (req) => req.params.id }),
  ctrl.verify
);

router.patch(
  '/:id/reconcile',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.PAYMENTS_RECONCILE),
  validate(schemas.reconcile),
  auditLogger('PAYMENT_RECONCILE', 'payments', { entityType: 'Payment', getEntityId: (req) => req.params.id }),
  ctrl.reconcile
);

module.exports = router;
