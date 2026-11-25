'use strict';

const express        = require('express');
const swaggerUi      = require('swagger-ui-express');
const router         = express.Router();
const { config }     = require('../config');
const { getDBStatus } = require('../config/database');
const { openApiSpec } = require('../docs/openapi');

const authRoutes         = require('../modules/auth/auth.routes');
const userRoutes         = require('../modules/users/user.routes');
const studentRoutes      = require('../modules/students/student.routes');
const facultyRoutes      = require('../modules/faculty/faculty.routes');
const departmentRoutes   = require('../modules/departments/department.routes');
const programRoutes      = require('../modules/programs/program.routes');
const academicYearRoutes = require('../modules/academic-years/academicYear.routes');
const semesterRoutes     = require('../modules/semesters/semester.routes');
const sectionRoutes      = require('../modules/sections/section.routes');
const courseRoutes       = require('../modules/courses/course.routes');
const enrollmentRoutes   = require('../modules/enrollments/enrollment.routes');
const attendanceRoutes   = require('../modules/attendance/attendance.routes');
const examinationRoutes  = require('../modules/examinations/examination.routes');
const assessmentRoutes   = require('../modules/assessments/assessment.routes');
const marksRoutes        = require('../modules/marks/marks.routes');
const resultRoutes       = require('../modules/results/result.routes');
const feeRoutes          = require('../modules/fees/fee.routes');
const paymentRoutes      = require('../modules/payments/payment.routes');
const timetableRoutes    = require('../modules/timetables/timetable.routes');
const announcementRoutes = require('../modules/announcements/announcement.routes');
const notificationRoutes = require('../modules/notifications/notification.routes');
const documentRoutes     = require('../modules/documents/document.routes');
const grievanceRoutes    = require('../modules/grievances/grievance.routes');
const reportRoutes       = require('../modules/reports/report.routes');
const auditLogRoutes     = require('../modules/audit-logs/auditLog.routes');
const settingRoutes      = require('../modules/system/systemSetting.routes');

/**
 * Liveness handler confirming HTTP process responsiveness without exposing DB details.
 */
const livenessHandler = (_req, res) => {
  res.status(200).json({
    status : 'ok',
    service: 'campuscore-api',
    time   : new Date().toISOString(),
  });
};

/**
 * Shared readiness/health handler reporting service status and MongoDB connectivity.
 * Omits internal DB name & runtime details in production so public probes leak no internals.
 */
const healthHandler = (_req, res) => {
  const db         = getDBStatus();
  const statusCode = db.isConnected ? 200 : 503;
  const isProd     = config.app.env === 'production';

  const databasePayload = {
    status     : db.status,
    isConnected: db.isConnected,
  };
  if (!isProd) {
    databasePayload.readyState = db.readyState;
    databasePayload.name       = db.database;
  }

  const responsePayload = {
    status  : db.isConnected ? 'ok' : 'degraded',
    service : 'campuscore-api',
    database: databasePayload,
    time    : new Date().toISOString(),
  };

  if (!isProd) {
    responsePayload.version = config.app.version;
    responsePayload.env     = config.app.env;
    responsePayload.uptime  = `${Math.floor(process.uptime())}s`;
  }

  res.status(statusCode).json(responsePayload);
};

router.get('/health',       healthHandler);
router.get('/health/live',  livenessHandler);
router.get('/health/ready', healthHandler);
router.get('/docs.json',    (_req, res) => res.status(200).json(openApiSpec));
router.use('/docs',         swaggerUi.serve, swaggerUi.setup(openApiSpec, { customSiteTitle: 'CAMPUSCORE API Docs' }));
router.use('/auth',           authRoutes);
router.use('/users',          userRoutes);
router.use('/students',       studentRoutes);
router.use('/faculty',        facultyRoutes);
router.use('/departments',    departmentRoutes);
router.use('/programs',       programRoutes);
router.use('/academic-years', academicYearRoutes);
router.use('/semesters',      semesterRoutes);
router.use('/sections',       sectionRoutes);
router.use('/courses',        courseRoutes);
router.use('/enrollments',    enrollmentRoutes);
router.use('/attendance',     attendanceRoutes);
router.use('/examinations',   examinationRoutes);
router.use('/assessments',    assessmentRoutes);
router.use('/marks',          marksRoutes);
router.use('/results',        resultRoutes);
router.use('/fees',           feeRoutes);
router.use('/payments',       paymentRoutes);
router.use('/timetables',     timetableRoutes);
router.use('/announcements',  announcementRoutes);
router.use('/notifications',  notificationRoutes);
router.use('/documents',      documentRoutes);
router.use('/grievances',     grievanceRoutes);
router.use('/reports',        reportRoutes);
router.use('/audit-logs',     auditLogRoutes);
router.use('/settings',       settingRoutes);

module.exports = { v1Routes: router, livenessHandler, healthHandler };
