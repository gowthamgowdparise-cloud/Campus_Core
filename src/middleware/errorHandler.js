'use strict';

const multer   = require('multer');
const logger   = require('../utils/logger');
const AppError = require('../utils/AppError');

/**
 * Centralised Express error handler.
 * Must be the LAST middleware registered in app.js.
 */
const errorHandler = (err, req, res, _next) => {
  let error = err;

  // ── Malformed JSON body ───────────────────────────────
  if (err instanceof SyntaxError && err.type === 'entity.parse.failed') {
    error = new AppError('Invalid JSON payload in request body.', 400);
  }

  // ── Body payload too large ────────────────────────────
  if (err.type === 'entity.too.large') {
    error = new AppError('Request payload exceeds maximum allowed size.', 413);
  }

  // ── Multer file upload errors ─────────────────────────
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      error = new AppError('Uploaded file exceeds maximum allowed size.', 413);
    } else {
      error = new AppError(`File upload error: ${err.message}`, 400);
    }
  }

  // ── Mongoose: bad ObjectId ────────────────────────────
  if (err.name === 'CastError') {
    error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
  }

  // ── Mongoose: duplicate key ───────────────────────────
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    const value = process.env.NODE_ENV === 'production' ? '' : `: "${err.keyValue?.[field]}"`;
    error = new AppError(`Duplicate value for ${field}${value}. Please use a different value.`, 409);
  }

  // ── Mongoose: validation error ────────────────────────
  if (err.name === 'ValidationError') {
    const details = Object.values(err.errors).map((e) => ({
      field  : e.path,
      message: e.message,
    }));
    error = new AppError('Database validation failed', 422, details);
  }

  // ── JWT errors ────────────────────────────────────────
  if (err.name === 'JsonWebTokenError') {
    error = new AppError('Invalid token. Please login again.', 401);
  }
  if (err.name === 'TokenExpiredError') {
    error = new AppError('Token has expired. Please login again.', 401);
  }

  const statusCode = error.statusCode || 500;
  const status     = error.status     || (statusCode < 500 ? 'fail' : 'error');
  const isProd     = process.env.NODE_ENV === 'production';

  // Never expose internal infrastructure/driver messages on unhandled 500s in production
  const message = isProd && statusCode >= 500 && !error.isOperational
    ? 'Internal Server Error'
    : (error.message || 'Internal Server Error');

  if (statusCode >= 500) {
    logger.error({
      requestId: req?.id,
      message  : err.message,
      stack    : err.stack,
      path     : req?.path,
      method   : req?.method,
    });
  }

  const body = { status, message };
  if (req?.id) body.requestId = req.id;
  if (error.details) body.details = error.details;
  if (!isProd && statusCode >= 500) {
    body.stack = err.stack;
  }

  res.status(statusCode).json(body);
};

/** Handle 404 – route not found */
const notFound = (req, res, next) => {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
};

module.exports = { errorHandler, notFound };
