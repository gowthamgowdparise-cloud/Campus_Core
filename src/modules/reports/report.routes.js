'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./report.controller');
const schemas  = require('./report.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { PERMISSIONS }       = require('../../config/permissions');

router.use(authenticate, requirePermission(PERMISSIONS.REPORTS_READ));

router.get('/institution-overview', authorize('admin'), ctrl.institutionOverview);
router.get('/attendance',           authorize('admin', 'faculty'), validate(schemas.attendanceQuery, 'query'), ctrl.attendanceReport);
router.get('/academic-performance', authorize('admin', 'faculty'), validate(schemas.academicPerformanceQuery, 'query'), ctrl.academicPerformance);
router.get('/fees',                 authorize('admin'), validate(schemas.feeReportQuery, 'query'), ctrl.feeReport);
router.get('/grievances',           authorize('admin'), ctrl.grievanceReport);

module.exports = router;
