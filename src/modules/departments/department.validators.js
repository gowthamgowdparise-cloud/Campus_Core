'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    isActive: Joi.boolean(),
  }),

  create: Joi.object({
    name           : Joi.string().trim().min(2).max(120).required(),
    code           : Joi.string().trim().uppercase().min(2).max(10).required(),
    description    : Joi.string().trim().max(1000).allow('', null),
    hod            : objectIdSchema.allow(null),
    isActive       : Joi.boolean().default(true),
    establishedYear: Joi.number().integer().min(1800).max(2100),
    website        : Joi.string().uri().allow('', null),
    email          : Joi.string().email().lowercase().trim().allow('', null),
  }),

  update: Joi.object({
    name           : Joi.string().trim().min(2).max(120),
    code           : Joi.string().trim().uppercase().min(2).max(10),
    description    : Joi.string().trim().max(1000).allow('', null),
    isActive       : Joi.boolean(),
    establishedYear: Joi.number().integer().min(1800).max(2100),
    website        : Joi.string().uri().allow('', null),
    email          : Joi.string().email().lowercase().trim().allow('', null),
  }).min(1),

  assignHod: Joi.object({
    hodId: objectIdSchema.allow(null).required(),
  }),
};

