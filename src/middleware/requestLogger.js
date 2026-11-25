'use strict';

const morgan = require('morgan');
const logger  = require('../utils/logger');

morgan.token('req-id', (req) => req.id || '-');

/** HTTP request logger using Morgan + Winston (includes correlation ID, never logs headers/bodies) */
const requestLogger = morgan(
  ':req-id :remote-addr :method :url :status :res[content-length] - :response-time ms',
  {
    stream: {
      write: (message) => logger.http(message.trim()),
    },
    skip: (req) => ['/health', '/health/live', '/health/ready'].includes(req.path),
  }
);

module.exports = requestLogger;
