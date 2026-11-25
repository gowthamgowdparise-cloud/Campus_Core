'use strict';

/**
 * Standard API response helpers.
 * Always use these instead of calling res.json() directly
 * to guarantee a consistent response envelope.
 */

/**
 * Send a successful JSON response.
 * @param {import('express').Response} res
 * @param {number}  statusCode  HTTP status (default 200).
 * @param {string}  message     Human-readable message.
 * @param {*}       [data]      Response payload.
 * @param {object}  [meta]      Pagination or extra metadata.
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null, meta = null) => {
  const body = { status: 'success', message };
  if (data !== null) body.data = data;
  if (meta !== null) body.meta = meta;
  return res.status(statusCode).json(body);
};

/**
 * Send an error JSON response.
 * @param {import('express').Response} res
 * @param {number}  statusCode  HTTP status (default 500).
 * @param {string}  message     Error message.
 * @param {*}       [details]   Field-level validation details.
 */
const sendError = (res, statusCode = 500, message = 'Internal Server Error', details = null) => {
  const body = { status: statusCode < 500 ? 'fail' : 'error', message };
  if (details !== null) body.details = details;
  return res.status(statusCode).json(body);
};

/**
 * Build a standard paginated meta block.
 */
const buildPaginationMeta = ({ page = 1, limit = 20, total = 0 }) => {
  const safePage  = Math.max(1, Number(page)  || 1);
  const safeLimit = Math.max(1, Number(limit) || 20);
  const safeTotal = Math.max(0, Number(total) || 0);
  return {
    page      : safePage,
    limit     : safeLimit,
    total     : safeTotal,
    totalPages: Math.ceil(safeTotal / safeLimit),
  };
};

module.exports = { sendSuccess, sendError, buildPaginationMeta };
