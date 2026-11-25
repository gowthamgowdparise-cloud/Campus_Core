'use strict';

/**
 * Wraps an async route handler so that uncaught promise rejections
 * are forwarded to Express's next(err) mechanism automatically.
 *
 * @param {Function} fn  Async Express route handler.
 * @returns {Function}   Synchronous Express route handler.
 */
const catchAsync = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = catchAsync;

