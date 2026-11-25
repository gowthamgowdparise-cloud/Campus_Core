'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    isRead: Joi.boolean(),
    type  : Joi.string().valid(
      'announcement', 'fee_due', 'attendance_low', 'result_published',
      'exam_scheduled', 'assignment_due', 'grievance_update', 'system',
      'password_changed', 'account_status', 'document_verified'
    ),
  }),

  createBulk: Joi.object({
    recipients: Joi.array().items(objectIdSchema).min(1).max(500).required(),
    type      : Joi.string().valid(
      'announcement', 'fee_due', 'attendance_low', 'result_published',
      'exam_scheduled', 'assignment_due', 'grievance_update', 'system',
      'password_changed', 'account_status', 'document_verified'
    ).default('system'),
    title     : Joi.string().trim().min(2).max(160).required(),
    message   : Joi.string().trim().min(2).max(2000).required(),
    priority  : Joi.string().valid('low', 'normal', 'high').default('normal'),
    channels  : Joi.array().items(Joi.string().valid('in_app', 'email', 'sms', 'push')).default(['in_app']),
    expiresAt : Joi.date().iso(),
  }),
};

