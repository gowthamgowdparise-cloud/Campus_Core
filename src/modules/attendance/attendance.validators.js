'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const recordItem = Joi.object({
  student: objectIdSchema.required(),
  status : Joi.string().valid('present', 'absent', 'late', 'excused', 'cancelled').required(),
  remarks: Joi.string().trim().max(300).allow('', null),
});

module.exports = {
  updatePolicy: Joi.object({
    minimumPercentage  : Joi.number().min(0).max(100),
    lateCountsAsPresent: Joi.boolean(),
    editWindowHours    : Joi.number().min(0).max(720),
  }).min(1),

  listSessionsQuery: paginationQuerySchema.keys({
    course      : objectIdSchema,
    section     : objectIdSchema,
    semester    : objectIdSchema,
    academicYear: objectIdSchema,
    faculty     : objectIdSchema,
    from        : Joi.date().iso(),
    to          : Joi.date().iso(),
    isFinalized : Joi.boolean(),
  }),

  createSession: Joi.object({
    course      : objectIdSchema.required(),
    section     : objectIdSchema.required(),
    semester    : objectIdSchema.required(),
    academicYear: objectIdSchema.required(),
    faculty     : objectIdSchema, // optional for admin override; derived from req.user for faculty
    date        : Joi.date().iso().required(),
    sessionType : Joi.string().valid('lecture', 'tutorial', 'practical', 'extra').default('lecture'),
    periodNumber: Joi.number().integer().min(1).default(1),
    startTime   : Joi.string().trim().max(10).allow('', null),
    endTime     : Joi.string().trim().max(10).allow('', null),
    topic       : Joi.string().trim().max(250).allow('', null),
    records     : Joi.array().items(recordItem).min(1).required(),
    isFinalized : Joi.boolean().default(false),
    remarks     : Joi.string().trim().max(500).allow('', null),
  }),

  updateSession: Joi.object({
    topic  : Joi.string().trim().max(250).allow('', null),
    records: Joi.array().items(recordItem).min(1),
    remarks: Joi.string().trim().max(500).allow('', null),
  }).min(1),

  summaryQuery: Joi.object({
    semester    : objectIdSchema,
    course      : objectIdSchema,
    academicYear: objectIdSchema,
  }),

  reportQuery: Joi.object({
    course  : objectIdSchema.required(),
    section : objectIdSchema.required(),
    semester: objectIdSchema.required(),
  }),

  createCorrection: Joi.object({
    attendanceSession    : objectIdSchema.required(),
    student              : objectIdSchema, // ignored for student role; derived from req.user
    requestedStatus      : Joi.string().valid('present', 'absent', 'late', 'excused').required(),
    reason               : Joi.string().trim().min(5).max(1000).required(),
    supportingDocumentUrl: Joi.string().trim().max(500).allow('', null),
  }),

  listCorrectionsQuery: paginationQuerySchema.keys({
    course  : objectIdSchema,
    section : objectIdSchema,
    semester: objectIdSchema,
    status  : Joi.string().valid('pending', 'approved', 'rejected'),
  }),

  reviewCorrection: Joi.object({
    decision     : Joi.string().valid('approved', 'rejected').required(),
    reviewRemarks: Joi.string().trim().max(500).allow('', null),
  }),

  studentIdParam: Joi.object({
    studentId: objectIdSchema.required(),
  }),
};

