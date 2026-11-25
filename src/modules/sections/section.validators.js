'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    program     : objectIdSchema,
    department  : objectIdSchema,
    academicYear: objectIdSchema,
    semester    : objectIdSchema,
    year        : Joi.number().integer().min(1).max(6),
    isActive    : Joi.boolean(),
  }),

  create: Joi.object({
    name          : Joi.string().trim().min(1).max(30).required(),
    program       : objectIdSchema.required(),
    department    : objectIdSchema.required(),
    academicYear  : objectIdSchema.required(),
    semester      : objectIdSchema.required(),
    year          : Joi.number().integer().min(1).max(6).required(),
    semesterNumber: Joi.number().integer().min(1).max(12),
    classTeacher  : objectIdSchema.allow(null),
    maxStrength   : Joi.number().integer().min(1).default(60),
    isActive      : Joi.boolean().default(true),
  }),

  update: Joi.object({
    name          : Joi.string().trim().min(1).max(30),
    year          : Joi.number().integer().min(1).max(6),
    semesterNumber: Joi.number().integer().min(1).max(12),
    maxStrength   : Joi.number().integer().min(1),
    isActive      : Joi.boolean(),
  }).min(1),

  assignClassTeacher: Joi.object({
    facultyId: objectIdSchema.allow(null).required(),
  }),
};

