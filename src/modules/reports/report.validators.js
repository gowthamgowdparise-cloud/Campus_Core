'use strict';

const Joi = require('joi');
const { objectIdSchema } = require('../../validators/common.validator');

module.exports = {
  attendanceQuery: Joi.object({
    course  : objectIdSchema.required(),
    section : objectIdSchema.required(),
    semester: objectIdSchema.required(),
  }),

  academicPerformanceQuery: Joi.object({
    course  : objectIdSchema.required(),
    semester: objectIdSchema.required(),
    section : objectIdSchema,
  }),

  feeReportQuery: Joi.object({
    academicYear: objectIdSchema,
    semester    : objectIdSchema,
  }),
};

