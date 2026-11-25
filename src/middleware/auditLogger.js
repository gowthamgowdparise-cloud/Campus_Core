'use strict';

const mongoose = require('mongoose');
const AuditLog = require('../modules/audit-logs/auditLog.model');
const logger   = require('../utils/logger');

const REDACT_KEYS = /(password|token|secret|authorization|cookie|cvv|cardnumber|pin)/i;

const sanitizeMetadata = (obj, depth = 0) => {
  if (!obj || typeof obj !== 'object' || depth > 3) return undefined;
  if (Array.isArray(obj)) return obj.slice(0, 20).map((item) => sanitizeMetadata(item, depth + 1));
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.test(k)) continue;
    out[k] = typeof v === 'object' && v !== null ? sanitizeMetadata(v, depth + 1) : v;
  }
  return out;
};

/**
 * auditLogger – non-blocking middleware that records API actions to AuditLog
 * after the HTTP response finishes.
 *
 * Options:
 *   logReads     {boolean}  Also log GET requests (e.g. document/material downloads)
 *   logAnonymous {boolean}  Log even when unauthenticated (e.g. failed login)
 *   entityType   {string}
 *   getEntityId  {Function} (req, resMeta) => ObjectId|string|null
 *   getMetadata  {Function} (req) => object (redacted automatically)
 */
const auditLogger = (action, moduleName, options = {}) => (req, res, next) => {
  const isMutation = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method);
  if (!isMutation && !options.logReads) {
    return next();
  }

  let responseMessage  = null;
  let responseEntityId = null;

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body.message === 'string') {
      responseMessage = body.message;
    }
    if (body?.data && typeof body.data === 'object' && body.data._id) {
      responseEntityId = body.data._id;
    }
    return originalJson(body);
  };

  res.on('finish', () => {
    if (mongoose.connection.readyState !== 1) return;

    const actor = req.user?.id || null;
    if (!actor && !options.logAnonymous) return;

    let resolvedEntityId = options.getEntityId
      ? options.getEntityId(req, { responseEntityId })
      : responseEntityId;
    if (resolvedEntityId && !mongoose.Types.ObjectId.isValid(String(resolvedEntityId))) {
      resolvedEntityId = null;
    }

    const safeMeta = options.getMetadata ? sanitizeMetadata(options.getMetadata(req)) : undefined;

    AuditLog.create({
      actor       : actor,
      actorRole   : req.user?.role  || 'anonymous',
      actorEmail  : req.user?.email || (typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : null),
      action,
      module      : moduleName,
      method      : req.method,
      endpoint    : req.originalUrl,
      entityType  : options.entityType || null,
      entityId    : resolvedEntityId || undefined,
      after       : safeMeta,
      ipAddress   : req.ip,
      userAgent   : req.headers['user-agent'],
      requestId   : req.id || null,
      statusCode  : res.statusCode,
      status      : res.statusCode < 400 ? 'success' : 'failure',
      errorMessage: res.statusCode >= 400 ? responseMessage : undefined,
    }).catch((err) => {
      logger.error(`AuditLog write failed: ${err.message}`);
    });
  });

  next();
};

/**
 * Persist an explicit internal security/audit event outside HTTP middleware (e.g. token reuse, webhooks).
 */
const recordSecurityAudit = (entry) => {
  if (mongoose.connection.readyState !== 1) return Promise.resolve(null);
  return AuditLog.create({
    ...entry,
    after: entry.after ? sanitizeMetadata(entry.after) : undefined,
  }).catch((err) => {
    logger.error(`Security AuditLog write failed: ${err.message}`);
    return null;
  });
};

module.exports = { auditLogger, recordSecurityAudit, sanitizeMetadata };
