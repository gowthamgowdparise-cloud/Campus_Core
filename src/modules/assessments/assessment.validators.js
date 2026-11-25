'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    course  : objectIdSchema,
    section : objectIdSchema,
    semester: objectIdSchema,
    faculty : objectIdSchema,
    type    : Joi.string().valid('quiz', 'assignment', 'lab_report', 'project', 'presentation', 'viva', 'class_test', 'other'),
    status  : Joi.string().valid('draft', 'published', 'ongoing', 'completed', 'cancelled'),
  }),

  create: Joi.object({
    title         : Joi.string().trim().min(2).max(160).required(),
    course        : objectIdSchema.required(),
    section       : objectIdSchema.required(),
    semester      : objectIdSchema.required(),
    academicYear  : objectIdSchema.required(),
    faculty       : objectIdSchema, // optional for admin; derived for faculty
    examination   : objectIdSchema.allow(null),
    type          : Joi.string().valid('quiz', 'assignment', 'lab_report', 'project', 'presentation', 'viva', 'class_test', 'other').required(),
    maxMarks      : Joi.number().min(0).required(),
    passingMarks  : Joi.number().min(0).default(0),
    weightage     : Joi.number().min(0).max(100).default(100),
    scheduledDate : Joi.date().iso(),
    submissionDate: Joi.date().iso(),
    status        : Joi.string().valid('draft', 'published', 'ongoing', 'completed', 'cancelled').default('draft'),
    instructions  : Joi.string().trim().max(2000).allow('', null),
  }),

  update: Joi.object({
    title         : Joi.string().trim().min(2).max(160),
    maxMarks      : Joi.number().min(0),
    passingMarks  : Joi.number().min(0),
    weightage     : Joi.number().min(0).max(100),
    scheduledDate : Joi.date().iso().allow(null),
    submissionDate: Joi.date().iso().allow(null),
    status        : Joi.string().valid('draft', 'published', 'ongoing', 'completed', 'cancelled'),
    instructions  : Joi.string().trim().max(2000).allow('', null),
    isGraded      : Joi.boolean(),
  }).min(1),
};

