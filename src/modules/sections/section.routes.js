'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./section.controller');
const schemas  = require('./section.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.SECTIONS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.SECTIONS_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.SECTIONS_MANAGE),
  validate(schemas.create),
  auditLogger('SECTION_CREATE', 'sections', { entityType: 'Section' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.SECTIONS_MANAGE),
  validate(schemas.update),
  auditLogger('SECTION_UPDATE', 'sections', { entityType: 'Section', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.patch(
  '/:id/class-teacher',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.SECTIONS_MANAGE),
  validate(schemas.assignClassTeacher),
  auditLogger('SECTION_CLASS_TEACHER_ASSIGN', 'sections', { entityType: 'Section', getEntityId: (req) => req.params.id }),
  ctrl.assignClassTeacher
);

module.exports = router;

