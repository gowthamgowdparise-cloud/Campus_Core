'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const scheduleSlotItem = Joi.object({
  course      : objectIdSchema.required(),
  examDate    : Joi.date().iso().required(),
  startTime   : Joi.string().trim().pattern(/^\d{2}:\d{2}$/).required(),
  endTime     : Joi.string().trim().pattern(/^\d{2}:\d{2}$/).required(),
  room        : Joi.string().trim().max(50).allow('', null),
  maxMarks    : Joi.number().min(0).default(100),
  passingMarks: Joi.number().min(0).default(40),
  invigilator : objectIdSchema.allow(null),
});

module.exports = {
  listQuery: paginationQuerySchema.keys({
    academicYear: objectIdSchema,
    semester    : objectIdSchema,
    program     : objectIdSchema,
    department  : objectIdSchema,
    type        : Joi.string().valid('internal', 'mid_term', 'end_term', 'practical', 'viva', 'project', 'supplementary', 'improvement'),
    status      : Joi.string().valid('scheduled', 'ongoing', 'completed', 'result_declared', 'cancelled'),
  }),

  create: Joi.object({
    name             : Joi.string().trim().min(2).max(160).required(),
    type             : Joi.string().valid('internal', 'mid_term', 'end_term', 'practical', 'viva', 'project', 'supplementary', 'improvement').required(),
    academicYear     : objectIdSchema.required(),
    semester         : objectIdSchema.required(),
    program          : objectIdSchema.required(),
    department       : objectIdSchema.required(),
    startDate        : Joi.date().iso().required(),
    endDate          : Joi.date().iso().min(Joi.ref('startDate')).required(),
    passingPercentage: Joi.number().min(0).max(100).default(40),
    maxGraceMark     : Joi.number().min(0).default(0),
    examSchedule     : Joi.array().items(scheduleSlotItem).default([]),
    remarks          : Joi.string().trim().max(500).allow('', null),
  }),

  update: Joi.object({
    name             : Joi.string().trim().min(2).max(160),
    startDate        : Joi.date().iso(),
    endDate          : Joi.date().iso(),
    passingPercentage: Joi.number().min(0).max(100),
    maxGraceMark     : Joi.number().min(0),
    remarks          : Joi.string().trim().max(500).allow('', null),
  }).min(1),

  updateSchedule: Joi.object({
    examSchedule: Joi.array().items(scheduleSlotItem).min(1).required(),
  }),

  updateStatus: Joi.object({
    status: Joi.string().valid('scheduled', 'ongoing', 'completed', 'result_declared', 'cancelled').required(),
  }),
};

