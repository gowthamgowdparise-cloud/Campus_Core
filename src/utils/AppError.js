'use strict';

/**
 * Custom application error class.
 * Carries an HTTP status code and optional field-level details.
 */
class AppError extends Error {
  /**
   * @param {string}  message    Human-readable error message.
   * @param {number}  statusCode HTTP status code (default 500).
   * @param {*}       [details]  Optional field-level validation details.
   */
  constructor(message, statusCode = 500, details = null) {
    super(message);
    this.name       = 'AppError';
    this.statusCode = statusCode;
    this.status     = statusCode >= 400 && statusCode < 500 ? 'fail' : 'error';
    this.isOperational = true;
    this.details    = details;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;

