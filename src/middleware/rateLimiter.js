'use strict';

const rateLimit = require('express-rate-limit');
const { config } = require('../config');

/** General API rate limiter (excludes health probes & signed provider webhooks) */
const apiRateLimit = rateLimit({
  windowMs        : config.rateLimit.windowMs,
  max             : config.rateLimit.max,
  standardHeaders : true,
  legacyHeaders   : false,
  message         : {
    status : 'fail',
    message: 'Too many requests. Please try again later.',
  },
  skip: (req) => (
    ['/health', '/health/live', '/health/ready'].includes(req.path) ||
    req.path.startsWith('/payments/webhooks/')
  ),
});

module.exports = apiRateLimit;
