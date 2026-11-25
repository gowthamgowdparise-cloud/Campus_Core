'use strict';

const AppError = require('../utils/AppError');

/**
 * validate – Joi schema validation middleware factory.
 *
 * Validates req.body against the given Joi schema.
 * On failure, throws a 422 AppError with field-level details.
 *
 * @param {import('joi').Schema} schema
 * @param {'body'|'query'|'params'} [target='body']
 */
const validate = (schema, target = 'body') => (req, res, next) => {
  const { error, value } = schema.validate(req[target], {
    abortEarly     : false,
    stripUnknown   : true,
    allowUnknown   : false,
  });

  if (error) {
    const details = error.details.map((d) => ({
      field  : d.path.join('.'),
      message: d.message.replace(/['"]/g, ''),
    }));
    return next(new AppError('Validation failed', 422, details));
  }

  // Replace with sanitised value
  req[target] = value;
  next();
};

module.exports = validate;

