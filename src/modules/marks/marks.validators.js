'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const markEntryItem = Joi.object({
  student      : objectIdSchema.required(),
  course       : objectIdSchema.required(),
  semester     : objectIdSchema.required(),
  academicYear : objectIdSchema.required(),
  assessment   : objectIdSchema.allow(null).default(null),
  examination  : objectIdSchema.allow(null).default(null),
  marksType    : Joi.string().valid('internal', 'external', 'practical', 'total', 'grace').required(),
  maxMarks     : Joi.number().min(0).required(),
  obtainedMarks: Joi.number().min(0).required(),
  graceMarks   : Joi.number().min(0).default(0),
  isAbsent     : Joi.boolean().default(false),
  isWithheld   : Joi.boolean().default(false),
  remarks      : Joi.string().trim().max(500).allow('', null),
});

module.exports = {
  listQuery: paginationQuerySchema.keys({
    student         : objectIdSchema,
    course          : objectIdSchema,
    semester        : objectIdSchema,
    assessment      : objectIdSchema,
    examination     : objectIdSchema,
    marksType       : Joi.string().valid('internal', 'external', 'practical', 'total', 'grace'),
    submissionStatus: Joi.string().valid('draft', 'submitted', 'approved', 'rejected'),
    isVerified      : Joi.boolean(),
  }),

  createSingle: markEntryItem,

  createBulk: Joi.object({
    entries: Joi.array().items(markEntryItem).min(1).max(200).required(),
  }),

  update: Joi.object({
    obtainedMarks: Joi.number().min(0),
    graceMarks   : Joi.number().min(0),
    isAbsent     : Joi.boolean(),
    isWithheld   : Joi.boolean(),
    remarks      : Joi.string().trim().max(500).allow('', null),
  }).min(1),

  submitMarks: Joi.object({
    markIds: Joi.array().items(objectIdSchema).min(1).max(200).required(),
  }),

  approveSingle: Joi.object({
    decision       : Joi.string().valid('approved', 'rejected').required(),
    rejectionReason: Joi.string().trim().max(500).when('decision', {
      is       : 'rejected',
      then     : Joi.required(),
      otherwise: Joi.allow('', null),
    }),
  }),

  approveBulk: Joi.object({
    markIds        : Joi.array().items(objectIdSchema).min(1).max(200).required(),
    decision       : Joi.string().valid('approved', 'rejected').required(),
    rejectionReason: Joi.string().trim().max(500).when('decision', {
      is       : 'rejected',
      then     : Joi.required(),
      otherwise: Joi.allow('', null),
    }),
  }),

  createCorrection: Joi.object({
    marksRecord   : objectIdSchema.required(),
    requestedMarks: Joi.number().min(0).allow(null),
    reason        : Joi.string().trim().min(5).max(1000).required(),
  }),

  listCorrectionsQuery: paginationQuerySchema.keys({
    course  : objectIdSchema,
    semester: objectIdSchema,
    status  : Joi.string().valid('pending', 'approved', 'rejected'),
  }),

  reviewCorrection: Joi.object({
    decision     : Joi.string().valid('approved', 'rejected').required(),
    updatedMarks : Joi.number().min(0),
    reviewRemarks: Joi.string().trim().max(500).allow('', null),
  }),
};

