'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./result.controller');
const schemas  = require('./result.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/me',          authorize('student'), requirePermission(PERMISSIONS.RESULTS_READ), ctrl.getMine);
router.get('/me/backlogs', authorize('student'), requirePermission(PERMISSIONS.RESULTS_READ), ctrl.getMyBacklogs);
router.get('/backlogs',    authorize('admin', 'faculty'), requirePermission(PERMISSIONS.RESULTS_READ), ctrl.getBacklogs);

router.get(
  '/reports/class-performance',
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.REPORTS_READ),
  validate(schemas.classPerformanceQuery, 'query'),
  ctrl.classPerformance
);

router.get(
  '/student/:studentId',
  validate(schemas.studentIdParam, 'params'),
  requirePermission(PERMISSIONS.RESULTS_READ),
  ctrl.getByStudent
);

router.get('/', requirePermission(PERMISSIONS.RESULTS_READ), validate(schemas.listQuery, 'query'), ctrl.list);

// Admin only: Result generation and final publication (Faculty explicitly excluded)
router.post(
  '/generate',
  authorize('admin'),
  requirePermission(PERMISSIONS.RESULTS_PUBLISH),
  validate(schemas.generate),
  auditLogger('RESULT_GENERATE', 'results', { entityType: 'Result' }),
  ctrl.generate
);

router.patch(
  '/:id/publish',
  validate(idParamSchema, 'params'),
  authorize('admin'),
  requirePermission(PERMISSIONS.RESULTS_PUBLISH),
  auditLogger('RESULT_PUBLISH', 'results', { entityType: 'Result', getEntityId: (req) => req.params.id }),
  ctrl.publish
);

module.exports = router;

