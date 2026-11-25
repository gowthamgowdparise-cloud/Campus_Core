'use strict';

const Joi = require('joi');
const { paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    group   : Joi.string().trim().max(60),
    isPublic: Joi.boolean(),
  }),

  keyParam: Joi.object({
    key: Joi.string().trim().min(2).max(100).required(),
  }),

  upsert: Joi.object({
    key        : Joi.string().trim().min(2).max(100).required(),
    value      : Joi.any().required(),
    dataType   : Joi.string().valid('string', 'number', 'boolean', 'json', 'array').required(),
    group      : Joi.string().trim().max(60).default('general'),
    label      : Joi.string().trim().max(150).allow('', null),
    description: Joi.string().trim().max(500).allow('', null),
    isPublic   : Joi.boolean().default(false),
    isEditable : Joi.boolean().default(true),
  }),

  updateByKey: Joi.object({
    value      : Joi.any().required(),
    dataType   : Joi.string().valid('string', 'number', 'boolean', 'json', 'array'),
    group      : Joi.string().trim().max(60),
    label      : Joi.string().trim().max(150).allow('', null),
    description: Joi.string().trim().max(500).allow('', null),
    isPublic   : Joi.boolean(),
  }),
};

