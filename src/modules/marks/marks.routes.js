'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./marks.controller');
const schemas  = require('./marks.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// ── Student self view ──────────────────────────────────────
router.get('/me', authorize('student'), requirePermission(PERMISSIONS.MARKS_READ), validate(schemas.listQuery, 'query'), ctrl.getMine);

// ── Marks correction workflow ──────────────────────────────
router.get('/corrections', requirePermission(PERMISSIONS.MARKS_READ), validate(schemas.listCorrectionsQuery, 'query'), ctrl.listCorrections);

router.post(
  '/corrections',
  requirePermission(PERMISSIONS.MARKS_CORRECTION_REQUEST),
  validate(schemas.createCorrection),
  auditLogger('MARKS_CORRECTION_REQUEST', 'marks', { entityType: 'MarksCorrectionRequest' }),
  ctrl.createCorrection
);

router.patch(
  '/corrections/:id/review',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.MARKS_CORRECTION_APPROVE),
  validate(schemas.reviewCorrection),
  auditLogger('MARKS_CORRECTION_REVIEW', 'marks', { entityType: 'MarksCorrectionRequest', getEntityId: (req) => req.params.id }),
  ctrl.reviewCorrection
);

// ── Submission & Admin Approval ────────────────────────────
router.post(
  '/submit',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.MARKS_SUBMIT),
  validate(schemas.submitMarks),
  auditLogger('MARKS_SUBMIT', 'marks', { entityType: 'Marks' }),
  ctrl.submit
);

router.post(
  '/approve-bulk',
  authorize('admin'),
  requirePermission(PERMISSIONS.MARKS_VERIFY),
  validate(schemas.approveBulk),
  auditLogger('MARKS_APPROVE_BULK', 'marks', { entityType: 'Marks' }),
  ctrl.approveBulk
);

router.patch(
  '/:id/approve',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.MARKS_VERIFY),
  validate(schemas.approveSingle),
  auditLogger('MARKS_APPROVE', 'marks', { entityType: 'Marks', getEntityId: (req) => req.params.id }),
  ctrl.approveSingle
);

// ── Entry & Listing ────────────────────────────────────────
router.get('/', requirePermission(PERMISSIONS.MARKS_READ), validate(schemas.listQuery, 'query'), ctrl.list);

router.post(
  '/',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.MARKS_ENTER),
  validate(schemas.createSingle),
  auditLogger('MARKS_ENTER', 'marks', { entityType: 'Marks' }),
  ctrl.createSingle
);

router.post(
  '/bulk',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.MARKS_ENTER),
  validate(schemas.createBulk),
  auditLogger('MARKS_BULK_ENTER', 'marks', { entityType: 'Marks' }),
  ctrl.createBulk
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.MARKS_ENTER),
  validate(schemas.update),
  auditLogger('MARKS_UPDATE', 'marks', { entityType: 'Marks', getEntityId: (req) => req.params.id }),
  ctrl.update
);

module.exports = router;

