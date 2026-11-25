'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    actor     : objectIdSchema,
    actorRole : Joi.string().valid('admin', 'faculty', 'student', 'anonymous'),
    action    : Joi.string().trim().max(100),
    module    : Joi.string().trim().max(60),
    entityType: Joi.string().trim().max(60),
    status    : Joi.string().valid('success', 'failure', 'partial'),
    from      : Joi.date().iso(),
    to        : Joi.date().iso(),
  }),
};

