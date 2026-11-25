'use strict';

const Joi = require('joi');

const passwordSchema = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
  .messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, digit, and special character',
  });

module.exports = {
  login: Joi.object({
    email   : Joi.string().email().lowercase().trim().required(),
    password: Joi.string().required(),
  }),

  // refreshToken may come from httpOnly cookie OR request body (for mobile clients)
  refreshToken: Joi.object({
    refreshToken: Joi.string().trim().min(1).optional(),
  }).default({}),

  // logout accepts refreshToken from httpOnly cookie OR request body
  logout: Joi.object({
    refreshToken: Joi.string().trim().min(1).optional(),
  }).default({}),

  changePassword: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword    : passwordSchema.required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required().messages({
      'any.only': 'Passwords do not match',
    }),
  }),
};
