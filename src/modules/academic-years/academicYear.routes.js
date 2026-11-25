'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./academicYear.controller');
const schemas  = require('./academicYear.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

// Calendar sub-routes before /:id
router.get(
  '/calendar/events',
  requirePermission(PERMISSIONS.ACADEMIC_CALENDAR_READ),
  validate(schemas.calendarQuery, 'query'),
  ctrl.listCalendar
);

router.post(
  '/calendar/events',
  requirePermission(PERMISSIONS.ACADEMIC_CALENDAR_MANAGE),
  validate(schemas.createCalendarEvent),
  auditLogger('CALENDAR_EVENT_CREATE', 'academic-years', { entityType: 'AcademicCalendarEvent' }),
  ctrl.createCalendarEvent
);

router.patch(
  '/calendar/events/:eventId',
  validate(schemas.eventIdParam, 'params'),
  requirePermission(PERMISSIONS.ACADEMIC_CALENDAR_MANAGE),
  validate(schemas.updateCalendarEvent),
  auditLogger('CALENDAR_EVENT_UPDATE', 'academic-years', { entityType: 'AcademicCalendarEvent', getEntityId: (req) => req.params.eventId }),
  ctrl.updateCalendarEvent
);

router.delete(
  '/calendar/events/:eventId',
  validate(schemas.eventIdParam, 'params'),
  requirePermission(PERMISSIONS.ACADEMIC_CALENDAR_MANAGE),
  auditLogger('CALENDAR_EVENT_DELETE', 'academic-years', { entityType: 'AcademicCalendarEvent', getEntityId: (req) => req.params.eventId }),
  ctrl.deleteCalendarEvent
);

router.get('/current', requirePermission(PERMISSIONS.ACADEMIC_YEARS_READ), ctrl.getCurrent);
router.get('/', requirePermission(PERMISSIONS.ACADEMIC_YEARS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.ACADEMIC_YEARS_READ), ctrl.getById);

router.post(
  '/',
  requirePermission(PERMISSIONS.ACADEMIC_YEARS_MANAGE),
  validate(schemas.create),
  auditLogger('ACADEMIC_YEAR_CREATE', 'academic-years', { entityType: 'AcademicYear' }),
  ctrl.create
);

router.patch(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.ACADEMIC_YEARS_MANAGE),
  validate(schemas.update),
  auditLogger('ACADEMIC_YEAR_UPDATE', 'academic-years', { entityType: 'AcademicYear', getEntityId: (req) => req.params.id }),
  ctrl.update
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.ACADEMIC_YEARS_MANAGE),
  auditLogger('ACADEMIC_YEAR_DELETE', 'academic-years', { entityType: 'AcademicYear', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;

