'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    student     : objectIdSchema,
    semester    : objectIdSchema,
    academicYear: objectIdSchema,
    examination : objectIdSchema,
    isPublished : Joi.boolean(),
    resultStatus: Joi.string().valid('pass', 'fail', 'withheld', 'promoted', 'detained'),
  }),

  generate: Joi.object({
    student     : objectIdSchema.required(),
    semester    : objectIdSchema.required(),
    academicYear: objectIdSchema.required(),
    examination : objectIdSchema.allow(null),
    remarks     : Joi.string().trim().max(500).allow('', null),
  }),

  studentIdParam: Joi.object({
    studentId: objectIdSchema.required(),
  }),

  classPerformanceQuery: Joi.object({
    course  : objectIdSchema.required(),
    semester: objectIdSchema.required(),
    section : objectIdSchema,
  }),
};

