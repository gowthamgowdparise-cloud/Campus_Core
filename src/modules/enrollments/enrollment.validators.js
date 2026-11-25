'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    student     : objectIdSchema,
    course      : objectIdSchema,
    section     : objectIdSchema,
    semester    : objectIdSchema,
    academicYear: objectIdSchema,
    status      : Joi.string().valid('enrolled', 'dropped', 'completed', 'failed', 'incomplete', 'exempted'),
  }),

  create: Joi.object({
    student     : objectIdSchema, // ignored for student self-registration; required for admin
    course      : objectIdSchema.required(),
    section     : objectIdSchema.required(),
    semester    : objectIdSchema.required(),
    academicYear: objectIdSchema.required(),
    faculty     : objectIdSchema.allow(null),
  }),

  bulkEnroll: Joi.object({
    studentIds  : Joi.array().items(objectIdSchema).min(1).max(200).required(),
    course      : objectIdSchema.required(),
    section     : objectIdSchema.required(),
    semester    : objectIdSchema.required(),
    academicYear: objectIdSchema.required(),
  }),

  drop: Joi.object({
    dropReason: Joi.string().trim().max(500).allow('', null),
  }),

  updateStatus: Joi.object({
    status            : Joi.string().valid('enrolled', 'dropped', 'completed', 'failed', 'incomplete', 'exempted').required(),
    isEligibleForExam : Joi.boolean(),
    ineligibilityReason: Joi.string().trim().max(300).allow('', null),
  }),
};

