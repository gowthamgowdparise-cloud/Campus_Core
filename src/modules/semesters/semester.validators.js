'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    academicYear: objectIdSchema,
    type        : Joi.string().valid('odd', 'even', 'summer'),
    status      : Joi.string().valid('upcoming', 'ongoing', 'exam_period', 'completed'),
    isCurrent   : Joi.boolean(),
  }),

  create: Joi.object({
    name          : Joi.string().trim().min(2).max(80).required(),
    academicYear  : objectIdSchema.required(),
    type          : Joi.string().valid('odd', 'even', 'summer').required(),
    semesterNumber: Joi.number().integer().min(1).max(12),
    startDate     : Joi.date().iso().required(),
    endDate       : Joi.date().iso().greater(Joi.ref('startDate')).required(),
    examStartDate : Joi.date().iso(),
    examEndDate   : Joi.date().iso().min(Joi.ref('examStartDate')),
    isCurrent     : Joi.boolean().default(false),
    status        : Joi.string().valid('upcoming', 'ongoing', 'exam_period', 'completed').default('upcoming'),
  }),

  update: Joi.object({
    name          : Joi.string().trim().min(2).max(80),
    type          : Joi.string().valid('odd', 'even', 'summer'),
    semesterNumber: Joi.number().integer().min(1).max(12),
    startDate     : Joi.date().iso(),
    endDate       : Joi.date().iso(),
    examStartDate : Joi.date().iso(),
    examEndDate   : Joi.date().iso(),
    isCurrent     : Joi.boolean(),
    status        : Joi.string().valid('upcoming', 'ongoing', 'exam_period', 'completed'),
  }).min(1),
};

