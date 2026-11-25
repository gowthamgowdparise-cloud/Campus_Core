'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const semesterConfigItem = Joi.object({
  semesterNumber: Joi.number().integer().min(1).max(12).required(),
  maxCredits    : Joi.number().min(0).default(30),
  minCredits    : Joi.number().min(0).default(15),
});

module.exports = {
  listQuery: paginationQuerySchema.keys({
    department: objectIdSchema,
    type      : Joi.string().valid('undergraduate', 'postgraduate', 'doctoral', 'diploma', 'certificate'),
    isActive  : Joi.boolean(),
  }),

  create: Joi.object({
    name               : Joi.string().trim().min(2).max(150).required(),
    code               : Joi.string().trim().uppercase().min(2).max(20).required(),
    shortName          : Joi.string().trim().max(30).allow('', null),
    department         : objectIdSchema.required(),
    type               : Joi.string().valid('undergraduate', 'postgraduate', 'doctoral', 'diploma', 'certificate').required(),
    duration           : Joi.number().integer().min(1).max(10).required(),
    totalSemesters     : Joi.number().integer().min(1).max(20).required(),
    totalCredits       : Joi.number().min(0),
    description        : Joi.string().trim().max(1000).allow('', null),
    semesterConfig     : Joi.array().items(semesterConfigItem),
    eligibilityCriteria: Joi.string().trim().max(1000).allow('', null),
    isActive           : Joi.boolean().default(true),
  }),

  update: Joi.object({
    name               : Joi.string().trim().min(2).max(150),
    code               : Joi.string().trim().uppercase().min(2).max(20),
    shortName          : Joi.string().trim().max(30).allow('', null),
    department         : objectIdSchema,
    type               : Joi.string().valid('undergraduate', 'postgraduate', 'doctoral', 'diploma', 'certificate'),
    duration           : Joi.number().integer().min(1).max(10),
    totalSemesters     : Joi.number().integer().min(1).max(20),
    totalCredits       : Joi.number().min(0),
    description        : Joi.string().trim().max(1000).allow('', null),
    semesterConfig     : Joi.array().items(semesterConfigItem),
    eligibilityCriteria: Joi.string().trim().max(1000).allow('', null),
    isActive           : Joi.boolean(),
  }).min(1),
};

