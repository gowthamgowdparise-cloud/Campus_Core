'use strict';

const rateLimit = require('express-rate-limit');
const { config } = require('../config');

/** Strict rate limiter for authentication endpoints */
const authRateLimit = rateLimit({
  windowMs        : config.rateLimit.authWindow,
  max             : config.rateLimit.authMax,
  standardHeaders : true,
  legacyHeaders   : false,
  message         : {
    status : 'fail',
    message: 'Too many authentication attempts. Please try again in 15 minutes.',
  },
});

module.exports = authRateLimit;

