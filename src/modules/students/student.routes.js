'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./student.controller');
const schemas  = require('./student.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission, requireAnyPermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// ── Student self-service endpoints ─────────────────────────
router.get('/me',                  authorize('student'), requirePermission(PERMISSIONS.STUDENTS_READ_OWN), ctrl.getMe);
router.patch('/me',                authorize('student'), validate(schemas.selfUpdate), auditLogger('STUDENT_SELF_UPDATE', 'students', { entityType: 'Student' }), ctrl.updateMe);
router.get('/me/academic-history', authorize('student'), requirePermission(PERMISSIONS.STUDENTS_READ_OWN), ctrl.getMyAcademicHistory);

// ── Admin & authorized staff endpoints ─────────────────────
router.get(
  '/',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.STUDENTS_READ),
  validate(schemas.listQuery, 'query'),
  ctrl.list
);

router.post(
  '/',
  authorize('admin'),
  requirePermission(PERMISSIONS.STUDENTS_CREATE),
  validate(schemas.create),
  auditLogger('STUDENT_ADMISSION', 'students', { entityType: 'Student' }),
  ctrl.create
);

router.get(
  '/:id',
  validate(idParamSchema, 'params'),
  requireAnyPermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN),
  ctrl.getById
);

router.get(
  '/:id/academic-history',
  validate(idParamSchema, 'params'),
  requireAnyPermission(PERMISSIONS.STUDENTS_READ, PERMISSIONS.STUDENTS_READ_OWN),
  ctrl.getAcademicHistory
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.STUDENTS_UPDATE),
  validate(schemas.adminUpdate),
  auditLogger('STUDENT_UPDATE', 'students', { entityType: 'Student', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.STUDENTS_DELETE),
  auditLogger('STUDENT_DELETE', 'students', { entityType: 'Student', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

