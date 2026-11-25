'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./course.controller');
const schemas  = require('./course.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { uploadSingleFile }  = require('../../middleware/upload');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// ── Faculty-Course Assignments ─────────────────────────────
router.get(
  '/assignments',
  requirePermission(PERMISSIONS.COURSE_ASSIGNMENTS_READ),
  validate(schemas.listAssignmentsQuery, 'query'),
  ctrl.listAssignments
);

router.post(
  '/assignments',
  requirePermission(PERMISSIONS.COURSE_ASSIGNMENTS_MANAGE),
  validate(schemas.createAssignment),
  auditLogger('COURSE_ASSIGNMENT_CREATE', 'courses', { entityType: 'CourseAssignment' }),
  ctrl.createAssignment
);

router.delete(
  '/assignments/:assignmentId',
  validate(schemas.assignmentIdParam, 'params'),
  requirePermission(PERMISSIONS.COURSE_ASSIGNMENTS_MANAGE),
  auditLogger('COURSE_ASSIGNMENT_DELETE', 'courses', { entityType: 'CourseAssignment', getEntityId: (req) => req.params.assignmentId }),
  ctrl.removeAssignment
);

// ── Course Materials ───────────────────────────────────────
router.get(
  '/materials/:materialId/download',
  validate(schemas.materialIdParam, 'params'),
  requirePermission(PERMISSIONS.COURSE_MATERIALS_READ),
  auditLogger('COURSE_MATERIAL_ACCESS', 'courses', { logReads: true, entityType: 'CourseMaterial', getEntityId: (req) => req.params.materialId }),
  ctrl.downloadMaterial
);

router.patch(
  '/materials/:materialId',
  validate(schemas.materialIdParam, 'params'),
  requirePermission(PERMISSIONS.COURSE_MATERIALS_MANAGE),
  validate(schemas.updateMaterial),
  auditLogger('COURSE_MATERIAL_UPDATE', 'courses', { entityType: 'CourseMaterial', getEntityId: (req) => req.params.materialId }),
  ctrl.updateMaterial
);

router.delete(
  '/materials/:materialId',
  validate(schemas.materialIdParam, 'params'),
  requirePermission(PERMISSIONS.COURSE_MATERIALS_MANAGE),
  auditLogger('COURSE_MATERIAL_DELETE', 'courses', { entityType: 'CourseMaterial', getEntityId: (req) => req.params.materialId }),
  ctrl.deleteMaterial
);

router.get(
  '/:courseId/materials',
  validate(schemas.courseIdParam, 'params'),
  requirePermission(PERMISSIONS.COURSE_MATERIALS_READ),
  validate(schemas.listMaterialsQuery, 'query'),
  ctrl.listMaterials
);

router.post(
  '/:courseId/materials',
  validate(schemas.courseIdParam, 'params'),
  requirePermission(PERMISSIONS.COURSE_MATERIALS_MANAGE),
  uploadSingleFile('file'),
  validate(schemas.createMaterial),
  auditLogger('COURSE_MATERIAL_CREATE', 'courses', { entityType: 'CourseMaterial' }),
  ctrl.createMaterial
);

// ── Course Catalog CRUD ────────────────────────────────────
router.get('/', requirePermission(PERMISSIONS.COURSES_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.COURSES_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.COURSES_MANAGE),
  validate(schemas.create),
  auditLogger('COURSE_CREATE', 'courses', { entityType: 'Course' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.COURSES_MANAGE),
  validate(schemas.update),
  auditLogger('COURSE_UPDATE', 'courses', { entityType: 'Course', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.COURSES_MANAGE),
  auditLogger('COURSE_DELETE', 'courses', { entityType: 'Course', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

