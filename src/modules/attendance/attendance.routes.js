'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./attendance.controller');
const schemas  = require('./attendance.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// ── Policy configuration ───────────────────────────────────
router.get('/policy', requirePermission(PERMISSIONS.ATTENDANCE_READ), ctrl.getPolicy);
router.put(
  '/policy',
  authorize('admin'),
  requirePermission(PERMISSIONS.SETTINGS_MANAGE),
  validate(schemas.updatePolicy),
  auditLogger('ATTENDANCE_POLICY_UPDATE', 'attendance', { entityType: 'SystemSetting' }),
  ctrl.updatePolicy
);

// ── Student self-view & summaries ──────────────────────────
router.get('/me', authorize('student'), requirePermission(PERMISSIONS.ATTENDANCE_READ), validate(schemas.summaryQuery, 'query'), ctrl.getMyAttendance);
router.get(
  '/students/:studentId/summary',
  validate(schemas.studentIdParam, 'params'),
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(schemas.summaryQuery, 'query'),
  ctrl.getStudentSummary
);

// ── Class report ───────────────────────────────────────────
router.get(
  '/reports',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(schemas.reportQuery, 'query'),
  ctrl.getReport
);

// ── Correction workflow ────────────────────────────────────
router.get(
  '/corrections',
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(schemas.listCorrectionsQuery, 'query'),
  ctrl.listCorrections
);

router.post(
  '/corrections',
  requirePermission(PERMISSIONS.ATTENDANCE_CORRECTION_REQUEST),
  validate(schemas.createCorrection),
  auditLogger('ATTENDANCE_CORRECTION_REQUEST', 'attendance', { entityType: 'AttendanceCorrectionRequest' }),
  ctrl.createCorrection
);

router.patch(
  '/corrections/:id/review',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_CORRECTION_APPROVE),
  validate(schemas.reviewCorrection),
  auditLogger('ATTENDANCE_CORRECTION_REVIEW', 'attendance', { entityType: 'AttendanceCorrectionRequest', getEntityId: (req) => req.params.id }),
  ctrl.reviewCorrection
);

// ── Attendance sessions (Admin & assigned Faculty) ─────────
router.get(
  '/sessions',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  validate(schemas.listSessionsQuery, 'query'),
  ctrl.listSessions
);

router.post(
  '/sessions',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_MARK),
  validate(schemas.createSession),
  auditLogger('ATTENDANCE_SESSION_CREATE', 'attendance', { entityType: 'Attendance' }),
  ctrl.createSession
);

router.get(
  '/sessions/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_READ),
  ctrl.getSession
);

router.patch(
  '/sessions/:id',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_MARK),
  validate(schemas.updateSession),
  auditLogger('ATTENDANCE_SESSION_UPDATE', 'attendance', { entityType: 'Attendance', getEntityId: (req) => req.params.id }),
  ctrl.updateSession
);

router.patch(
  '/sessions/:id/finalize',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.ATTENDANCE_MARK),
  auditLogger('ATTENDANCE_SESSION_FINALIZE', 'attendance', { entityType: 'Attendance', getEntityId: (req) => req.params.id }),
  ctrl.finalizeSession
);

module.exports = router;

