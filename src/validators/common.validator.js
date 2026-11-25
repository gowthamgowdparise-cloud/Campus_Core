'use strict';

const Joi = require('joi');

/** Reusable MongoDB ObjectId validator */
const objectIdSchema = Joi.string()
  .trim()
  .pattern(/^[0-9a-fA-F]{24}$/)
  .messages({
    'string.pattern.base': '{{#label}} must be a valid 24-character ObjectId',
  });

/** Standard :id route param validator */
const idParamSchema = Joi.object({
  id: objectIdSchema.required(),
});

/** Standard pagination / sorting query validator */
const paginationQuerySchema = Joi.object({
  page  : Joi.number().integer().min(1).default(1),
  limit : Joi.number().integer().min(1).max(100).default(20),
  sort  : Joi.string().trim().max(50).default('-createdAt'),
  search: Joi.string().trim().max(100).allow('').optional(),
});

/** Reusable date range query validator */
const dateRangeSchema = Joi.object({
  startDate: Joi.date().iso(),
  endDate  : Joi.date().iso().min(Joi.ref('startDate')).messages({
    'date.min': 'endDate must be on or after startDate',
  }),
});

module.exports = {
  objectIdSchema,
  idParamSchema,
  paginationQuerySchema,
  dateRangeSchema,
};

