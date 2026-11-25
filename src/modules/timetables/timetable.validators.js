'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const periodItem = Joi.object({
  periodNumber: Joi.number().integer().min(1).required(),
  startTime   : Joi.string().trim().pattern(/^\d{2}:\d{2}$/).required(),
  endTime     : Joi.string().trim().pattern(/^\d{2}:\d{2}$/).required(),
  course      : objectIdSchema.allow(null),
  faculty     : objectIdSchema.allow(null),
  room        : Joi.string().trim().max(40).allow('', null),
  type        : Joi.string().valid('lecture', 'tutorial', 'practical', 'break', 'lunch', 'free').default('lecture'),
});

const dayScheduleItem = Joi.object({
  day    : Joi.string().valid('Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun').required(),
  periods: Joi.array().items(periodItem).required(),
});

module.exports = {
  listQuery: paginationQuerySchema.keys({
    section     : objectIdSchema,
    semester    : objectIdSchema,
    academicYear: objectIdSchema,
    status      : Joi.string().valid('draft', 'published', 'archived'),
    isActive    : Joi.boolean(),
  }),

  create: Joi.object({
    section      : objectIdSchema.required(),
    semester     : objectIdSchema.required(),
    academicYear : objectIdSchema.required(),
    effectiveFrom: Joi.date().iso().required(),
    effectiveTo  : Joi.date().iso().min(Joi.ref('effectiveFrom')),
    isActive     : Joi.boolean().default(true),
    schedule     : Joi.array().items(dayScheduleItem).min(1).required(),
    status       : Joi.string().valid('draft', 'published', 'archived').default('draft'),
  }),

  update: Joi.object({
    effectiveFrom: Joi.date().iso(),
    effectiveTo  : Joi.date().iso(),
    isActive     : Joi.boolean(),
    schedule     : Joi.array().items(dayScheduleItem).min(1),
    status       : Joi.string().valid('draft', 'published', 'archived'),
  }).min(1),
};

