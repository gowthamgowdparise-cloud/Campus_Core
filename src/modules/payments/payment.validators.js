'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    student             : objectIdSchema,
    feeRecord           : objectIdSchema,
    mode                : Joi.string().valid('online', 'cash', 'dd', 'cheque', 'neft', 'rtgs', 'upi', 'card'),
    status              : Joi.string().valid('pending', 'success', 'failed', 'refunded', 'cancelled'),
    reconciliationStatus: Joi.string().valid('unreconciled', 'matched', 'discrepancy'),
    provider            : Joi.string().valid('manual', 'razorpay', 'stripe'),
  }),

  // Never allow cardNumber, cvv, pin, client status overrides, or raw payment credentials
  create: Joi.object({
    feeRecord     : objectIdSchema.required(),
    amount        : Joi.number().min(1).required(),
    mode          : Joi.string().valid('online', 'cash', 'dd', 'cheque', 'neft', 'rtgs', 'upi', 'card').required(),
    transactionId : Joi.string().trim().max(120).allow('', null),
    idempotencyKey: Joi.string().trim().min(4).max(120).allow('', null),
    bankName      : Joi.string().trim().max(120).allow('', null),
    chequeNumber  : Joi.string().trim().max(60).allow('', null),
    chequeDate    : Joi.date().iso(),
    ddNumber      : Joi.string().trim().max(60).allow('', null),
    remarks       : Joi.string().trim().max(500).allow('', null),
  }),

  initiate: Joi.object({
    feeRecord     : objectIdSchema.required(),
    amount        : Joi.number().min(1).required(),
    provider      : Joi.string().valid('razorpay', 'stripe'),
    idempotencyKey: Joi.string().trim().min(4).max(120).allow('', null),
    remarks       : Joi.string().trim().max(500).allow('', null),
  }),

  verify: Joi.object({
    providerOrderId  : Joi.string().trim().min(3).max(160).required(),
    providerPaymentId: Joi.string().trim().min(3).max(160).required(),
    providerSignature: Joi.string().trim().min(10).max(512).required(),
  }),

  webhookParams: Joi.object({
    provider: Joi.string().valid('razorpay', 'stripe').required(),
  }),

  reconcile: Joi.object({
    reconciliationStatus   : Joi.string().valid('matched', 'discrepancy').required(),
    paymentStatus          : Joi.string().valid('success', 'failed', 'cancelled'),
    reconciliationReference: Joi.string().trim().max(120).required(),
    remarks                : Joi.string().trim().max(500).allow('', null),
  }),
};
