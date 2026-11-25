'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    category  : Joi.string().valid('academic', 'fee', 'examination', 'attendance', 'facility', 'hostel', 'library', 'administration', 'harassment', 'other'),
    priority  : Joi.string().valid('low', 'medium', 'high', 'critical'),
    status    : Joi.string().valid('open', 'in_progress', 'awaiting_response', 'resolved', 'closed', 'rejected'),
    department: objectIdSchema,
  }),

  create: Joi.object({
    category   : Joi.string().valid('academic', 'fee', 'examination', 'attendance', 'facility', 'hostel', 'library', 'administration', 'harassment', 'other').required(),
    subject    : Joi.string().trim().min(3).max(200).required(),
    description: Joi.string().trim().min(5).max(5000).required(),
    priority   : Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    department : objectIdSchema.allow(null),
    attachments: Joi.array().items(Joi.string().trim()).default([]),
  }),

  addComment: Joi.object({
    comment   : Joi.string().trim().min(1).max(2000).required(),
    isInternal: Joi.boolean().default(false),
  }),

  assign: Joi.object({
    assignedTo: objectIdSchema.allow(null).required(),
  }),

  updateStatus: Joi.object({
    status    : Joi.string().valid('open', 'in_progress', 'awaiting_response', 'resolved', 'closed', 'rejected').required(),
    resolution: Joi.string().trim().max(2000).allow('', null),
  }),
};

