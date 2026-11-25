'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    status   : Joi.string().valid('upcoming', 'active', 'completed'),
    isCurrent: Joi.boolean(),
  }),

  create: Joi.object({
    name       : Joi.string().trim().min(4).max(40).required(),
    startDate  : Joi.date().iso().required(),
    endDate    : Joi.date().iso().greater(Joi.ref('startDate')).required(),
    isCurrent  : Joi.boolean().default(false),
    status     : Joi.string().valid('upcoming', 'active', 'completed').default('upcoming'),
    description: Joi.string().trim().max(500).allow('', null),
  }),

  update: Joi.object({
    name       : Joi.string().trim().min(4).max(40),
    startDate  : Joi.date().iso(),
    endDate    : Joi.date().iso(),
    isCurrent  : Joi.boolean(),
    status     : Joi.string().valid('upcoming', 'active', 'completed'),
    description: Joi.string().trim().max(500).allow('', null),
  }).min(1),

  calendarQuery: paginationQuerySchema.keys({
    academicYear: objectIdSchema,
    semester    : objectIdSchema,
    department  : objectIdSchema,
    eventType   : Joi.string().valid('holiday', 'exam', 'registration', 'orientation', 'vacation', 'convocation', 'deadline', 'academic_event'),
    from        : Joi.date().iso(),
    to          : Joi.date().iso(),
  }),

  createCalendarEvent: Joi.object({
    title       : Joi.string().trim().min(2).max(180).required(),
    description : Joi.string().trim().max(1000).allow('', null),
    academicYear: objectIdSchema.required(),
    semester    : objectIdSchema.allow(null),
    department  : objectIdSchema.allow(null),
    eventType   : Joi.string().valid('holiday', 'exam', 'registration', 'orientation', 'vacation', 'convocation', 'deadline', 'academic_event').required(),
    startDate   : Joi.date().iso().required(),
    endDate     : Joi.date().iso().min(Joi.ref('startDate')).required(),
    isHoliday   : Joi.boolean().default(false),
    targetRoles : Joi.array().items(Joi.string().valid('all', 'admin', 'faculty', 'student')).default(['all']),
  }),

  updateCalendarEvent: Joi.object({
    title       : Joi.string().trim().min(2).max(180),
    description : Joi.string().trim().max(1000).allow('', null),
    semester    : objectIdSchema.allow(null),
    department  : objectIdSchema.allow(null),
    eventType   : Joi.string().valid('holiday', 'exam', 'registration', 'orientation', 'vacation', 'convocation', 'deadline', 'academic_event'),
    startDate   : Joi.date().iso(),
    endDate     : Joi.date().iso(),
    isHoliday   : Joi.boolean(),
    targetRoles : Joi.array().items(Joi.string().valid('all', 'admin', 'faculty', 'student')),
  }).min(1),

  eventIdParam: Joi.object({
    eventId: objectIdSchema.required(),
  }),
};

