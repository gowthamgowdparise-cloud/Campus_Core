'use strict';

const Joi = require('joi');
const { paginationQuerySchema } = require('../../validators/common.validator');

const strongPassword = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
  .messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, digit, and special character',
  });

module.exports = {
  listUsersQuery: paginationQuerySchema.keys({
    role  : Joi.string().valid('admin', 'faculty', 'student'),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'pending_verification'),
  }),

  createUser: Joi.object({
    firstName         : Joi.string().trim().min(1).max(50).required(),
    lastName          : Joi.string().trim().min(1).max(50).required(),
    email             : Joi.string().email().lowercase().trim().required(),
    password          : strongPassword.required(),
    role              : Joi.string().valid('admin', 'faculty', 'student').required(),
    phone             : Joi.string().trim().max(20).allow('', null),
    gender            : Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
    dateOfBirth       : Joi.date().iso(),
    status            : Joi.string().valid('active', 'inactive', 'pending_verification').default('active'),
    mustChangePassword: Joi.boolean().default(true),
  }),

  updateUser: Joi.object({
    firstName         : Joi.string().trim().min(1).max(50),
    lastName          : Joi.string().trim().min(1).max(50),
    phone             : Joi.string().trim().max(20).allow('', null),
    gender            : Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
    dateOfBirth       : Joi.date().iso(),
    profilePicture    : Joi.string().trim().max(500).allow('', null),
    mustChangePassword: Joi.boolean(),
  }).min(1),

  updateStatus: Joi.object({
    status: Joi.string().valid('active', 'inactive', 'suspended', 'pending_verification').required(),
  }),

  updateRole: Joi.object({
    role: Joi.string().valid('admin', 'faculty', 'student').required(),
  }),
};

