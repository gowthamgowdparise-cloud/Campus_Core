'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./semester.controller');
const schemas  = require('./semester.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/current', requirePermission(PERMISSIONS.SEMESTERS_READ), ctrl.getCurrent);
router.get('/', requirePermission(PERMISSIONS.SEMESTERS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.SEMESTERS_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.SEMESTERS_MANAGE),
  validate(schemas.create),
  auditLogger('SEMESTER_CREATE', 'semesters', { entityType: 'Semester' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.SEMESTERS_MANAGE),
  validate(schemas.update),
  auditLogger('SEMESTER_UPDATE', 'semesters', { entityType: 'Semester', getEntityId: (req) => req.params.id }),
  ctrl.update
);

module.exports = router;

