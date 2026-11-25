'use strict';

const crypto = require('crypto');

const SAFE_REQUEST_ID_REGEX = /^[A-Za-z0-9_.-]{8,64}$/;

/**
 * Attach a validated or freshly generated X-Request-Id correlation identifier
 * to both req.id and response headers for tracing logs and audit events.
 */
const requestIdMiddleware = (req, res, next) => {
  const incoming = req.headers['x-request-id'];
  const correlationId = typeof incoming === 'string' && SAFE_REQUEST_ID_REGEX.test(incoming.trim())
    ? incoming.trim()
    : crypto.randomUUID();

  req.id = correlationId;
  res.setHeader('X-Request-Id', correlationId);
  next();
};

module.exports = requestIdMiddleware;

