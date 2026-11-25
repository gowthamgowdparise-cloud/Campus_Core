'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./faculty.controller');
const schemas  = require('./faculty.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// ── Faculty self-service endpoints ─────────────────────────
router.get('/me',           authorize('faculty'), ctrl.getMe);
router.patch('/me',         authorize('faculty'), validate(schemas.selfUpdate), auditLogger('FACULTY_SELF_UPDATE', 'faculty', { entityType: 'Faculty' }), ctrl.updateMe);
router.get('/me/courses',   authorize('faculty'), ctrl.getMyCourses);
router.get('/me/students',  authorize('faculty'), validate(schemas.meStudentsQuery, 'query'), ctrl.getMyStudents);
router.get('/me/timetable', authorize('faculty'), ctrl.getMyTimetable);

// ── Admin management endpoints ─────────────────────────────
router.get('/', authorize('admin'), requirePermission(PERMISSIONS.FACULTY_READ), validate(schemas.listQuery, 'query'), ctrl.list);

router.post(
  '/',
  authorize('admin'),
  requirePermission(PERMISSIONS.FACULTY_CREATE),
  validate(schemas.create),
  auditLogger('FACULTY_CREATE', 'faculty', { entityType: 'Faculty' }),
  ctrl.create
);

router.get('/:id', validate(idParamSchema, 'params'), authorize('admin', 'faculty'), requirePermission(PERMISSIONS.FACULTY_READ), ctrl.getById);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.FACULTY_UPDATE),
  validate(schemas.adminUpdate),
  auditLogger('FACULTY_UPDATE', 'faculty', { entityType: 'Faculty', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.FACULTY_DELETE),
  auditLogger('FACULTY_DELETE', 'faculty', { entityType: 'Faculty', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

