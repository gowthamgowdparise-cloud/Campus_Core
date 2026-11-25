'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    type     : Joi.string().valid('general', 'academic', 'exam', 'fee', 'event', 'holiday', 'urgent'),
    priority : Joi.string().valid('low', 'normal', 'high', 'critical'),
    isPinned : Joi.boolean(),
    isActive : Joi.boolean(),
  }),

  create: Joi.object({
    title            : Joi.string().trim().min(2).max(200).required(),
    content          : Joi.string().trim().min(2).max(10000).required(),
    type             : Joi.string().valid('general', 'academic', 'exam', 'fee', 'event', 'holiday', 'urgent').default('general'),
    targetRoles      : Joi.array().items(Joi.string().valid('admin', 'faculty', 'student', 'all')).min(1).default(['all']),
    targetDepartments: Joi.array().items(objectIdSchema).default([]),
    targetPrograms   : Joi.array().items(objectIdSchema).default([]),
    targetSections   : Joi.array().items(objectIdSchema).default([]),
    publishAt        : Joi.date().iso(),
    expiresAt        : Joi.date().iso().allow(null),
    isPinned         : Joi.boolean().default(false),
    priority         : Joi.string().valid('low', 'normal', 'high', 'critical').default('normal'),
    attachments      : Joi.array().items(Joi.string().trim()).default([]),
  }),

  update: Joi.object({
    title      : Joi.string().trim().min(2).max(200),
    content    : Joi.string().trim().min(2).max(10000),
    type       : Joi.string().valid('general', 'academic', 'exam', 'fee', 'event', 'holiday', 'urgent'),
    expiresAt  : Joi.date().iso().allow(null),
    isPinned   : Joi.boolean(),
    priority   : Joi.string().valid('low', 'normal', 'high', 'critical'),
    isActive   : Joi.boolean(),
    attachments: Joi.array().items(Joi.string().trim()),
  }).min(1),
};

