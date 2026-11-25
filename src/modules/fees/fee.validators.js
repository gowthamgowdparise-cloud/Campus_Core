'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const feeComponentItem = Joi.object({
  name       : Joi.string().trim().min(1).max(100).required(),
  amount     : Joi.number().min(0).required(),
  isMandatory: Joi.boolean().default(true),
  description: Joi.string().trim().max(300).allow('', null),
});

module.exports = {
  listStructuresQuery: paginationQuerySchema.keys({
    program     : objectIdSchema,
    academicYear: objectIdSchema,
    year        : Joi.number().integer().min(1).max(6),
    category    : Joi.string().valid('general', 'obc', 'sc_st', 'nri', 'management'),
    isActive    : Joi.boolean(),
  }),

  createStructure: Joi.object({
    name          : Joi.string().trim().min(2).max(150).required(),
    program       : objectIdSchema.required(),
    academicYear  : objectIdSchema.required(),
    year          : Joi.number().integer().min(1).max(6).required(),
    category      : Joi.string().valid('general', 'obc', 'sc_st', 'nri', 'management').default('general'),
    components    : Joi.array().items(feeComponentItem).min(1).required(),
    totalAmount   : Joi.number().min(0),
    lateFinePerDay: Joi.number().min(0).default(0),
    dueDate       : Joi.date().iso(),
    isActive      : Joi.boolean().default(true),
  }),

  updateStructure: Joi.object({
    name          : Joi.string().trim().min(2).max(150),
    components    : Joi.array().items(feeComponentItem).min(1),
    totalAmount   : Joi.number().min(0),
    lateFinePerDay: Joi.number().min(0),
    dueDate       : Joi.date().iso().allow(null),
    isActive      : Joi.boolean(),
  }).min(1),

  listRecordsQuery: paginationQuerySchema.keys({
    student     : objectIdSchema,
    academicYear: objectIdSchema,
    semester    : objectIdSchema,
    status      : Joi.string().valid('pending', 'partial', 'paid', 'overdue', 'waived', 'refunded'),
  }),

  assignFee: Joi.object({
    feeStructure    : objectIdSchema.required(),
    studentIds      : Joi.array().items(objectIdSchema).min(1).max(200).required(),
    semester        : objectIdSchema.allow(null).default(null),
    dueDate         : Joi.date().iso(),
    concessionAmount: Joi.number().min(0).default(0),
    concessionReason: Joi.string().trim().max(300).allow('', null),
    isScholarship   : Joi.boolean().default(false),
    remarks         : Joi.string().trim().max(500).allow('', null),
  }),

  updateConcession: Joi.object({
    concessionAmount: Joi.number().min(0),
    concessionReason: Joi.string().trim().max(300).allow('', null),
    isScholarship   : Joi.boolean(),
    lateFine        : Joi.number().min(0),
    status          : Joi.string().valid('pending', 'partial', 'paid', 'overdue', 'waived', 'refunded'),
    remarks         : Joi.string().trim().max(500).allow('', null),
  }).min(1),

  applyLateFines: Joi.object({
    academicYear: objectIdSchema,
    semester    : objectIdSchema,
    asOfDate    : Joi.date().iso(),
  }),
};

