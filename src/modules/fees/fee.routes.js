'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./fee.controller');
const schemas  = require('./fee.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission, requireAnyPermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// ── Student self view ──────────────────────────────────────
router.get('/me', authorize('student'), requirePermission(PERMISSIONS.FEES_READ_OWN), ctrl.getMyFees);

// ── Fee Structures ─────────────────────────────────────────
router.get(
  '/structures',
  requireAnyPermission(PERMISSIONS.FEES_MANAGE, PERMISSIONS.FEES_READ_OWN),
  validate(schemas.listStructuresQuery, 'query'),
  ctrl.listStructures
);

router.get(
  '/structures/:id',
  validate(idParamSchema, 'params'),
  requireAnyPermission(PERMISSIONS.FEES_MANAGE, PERMISSIONS.FEES_READ_OWN),
  ctrl.getStructure
);

router.post(
  '/structures',
  authorize('admin'),
  requirePermission(PERMISSIONS.FEES_MANAGE),
  validate(schemas.createStructure),
  auditLogger('FEE_STRUCTURE_CREATE', 'fees', { entityType: 'FeeStructure' }),
  ctrl.createStructure
);

router.patch(
  '/structures/:id',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.FEES_MANAGE),
  validate(schemas.updateStructure),
  auditLogger('FEE_STRUCTURE_UPDATE', 'fees', { entityType: 'FeeStructure', getEntityId: (req) => req.params.id }),
  ctrl.updateStructure
);

// ── Fee Records & Assignment ───────────────────────────────
router.get(
  '/records',
  requireAnyPermission(PERMISSIONS.FEES_MANAGE, PERMISSIONS.FEES_READ_OWN),
  validate(schemas.listRecordsQuery, 'query'),
  ctrl.listRecords
);

router.get(
  '/records/:id',
  validate(idParamSchema, 'params'),
  requireAnyPermission(PERMISSIONS.FEES_MANAGE, PERMISSIONS.FEES_READ_OWN),
  ctrl.getRecord
);

router.post(
  '/records/assign',
  authorize('admin'),
  requirePermission(PERMISSIONS.FEES_MANAGE),
  validate(schemas.assignFee),
  auditLogger('FEE_RECORD_ASSIGN', 'fees', { entityType: 'FeeRecord' }),
  ctrl.assignFees
);

router.patch(
  '/records/:id/concession',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.FEES_MANAGE),
  validate(schemas.updateConcession),
  auditLogger('FEE_RECORD_CONCESSION', 'fees', { entityType: 'FeeRecord', getEntityId: (req) => req.params.id }),
  ctrl.updateConcession
);

router.post(
  '/records/apply-late-fines',
  authorize('admin'),
  requirePermission(PERMISSIONS.FEES_MANAGE),
  validate(schemas.applyLateFines),
  auditLogger('FEE_LATE_FINES_APPLIED', 'fees', { entityType: 'FeeRecord' }),
  ctrl.applyLateFines
);

module.exports = router;

