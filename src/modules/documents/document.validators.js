'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    type      : Joi.string().valid(
      'admission_form', 'marksheet', 'transfer_certificate', 'migration_certificate',
      'bonafide', 'fee_receipt', 'id_card', 'character_certificate', 'noc',
      'scholarship_form', 'other'
    ),
    status    : Joi.string().valid('uploaded', 'under_review', 'verified', 'rejected', 'expired'),
    student   : objectIdSchema,
    isVerified: Joi.boolean(),
  }),

  create: Joi.object({
    title    : Joi.string().trim().min(2).max(180).required(),
    type     : Joi.string().valid(
      'admission_form', 'marksheet', 'transfer_certificate', 'migration_certificate',
      'bonafide', 'fee_receipt', 'id_card', 'character_certificate', 'noc',
      'scholarship_form', 'other'
    ).required(),
    owner    : objectIdSchema, // honored only for Admin
    student  : objectIdSchema.allow(null),
    expiresAt: Joi.date().iso().allow(null),
    isPublic : Joi.boolean().default(false),
  }),

  verify: Joi.object({
    decision       : Joi.string().valid('verified', 'rejected').required(),
    rejectionReason: Joi.string().trim().max(500).when('decision', {
      is       : 'rejected',
      then     : Joi.required(),
      otherwise: Joi.allow('', null),
    }),
  }),
};
