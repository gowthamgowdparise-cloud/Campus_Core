'use strict';

/**
 * Shared query helpers for pagination, safe sorting, and ReDoS-safe regex search.
 */

/**
 * Escape special regex characters in user-supplied search input.
 * @param {string} value
 * @returns {string}
 */
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Extract validated pagination parameters from req.query.
 */
const parsePagination = (query = {}) => {
  const page  = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  const skip  = (page - 1) * limit;
  return { page, limit, skip };
};

/**
 * Parse a sort string like "-createdAt,name" against a whitelist of allowed fields.
 * Prevents sorting on sensitive or arbitrary paths.
 */
const parseSort = (sortStr, allowedFields = ['createdAt'], defaultSort = { createdAt: -1 }) => {
  if (!sortStr || typeof sortStr !== 'string') return defaultSort;

  const sortObj = {};
  const parts = sortStr.split(',').map((s) => s.trim()).filter(Boolean);

  for (const part of parts) {
    const desc = part.startsWith('-');
    const field = desc ? part.slice(1) : part;
    if (allowedFields.includes(field)) {
      sortObj[field] = desc ? -1 : 1;
    }
  }

  return Object.keys(sortObj).length > 0 ? sortObj : defaultSort;
};

/**
 * Build a case-insensitive MongoDB $or regex filter across allowed text fields.
 */
const buildSearchFilter = (search, fields = []) => {
  if (!search || typeof search !== 'string' || !search.trim() || fields.length === 0) {
    return null;
  }
  const regex = new RegExp(escapeRegex(search.trim()), 'i');
  return { $or: fields.map((field) => ({ [field]: regex })) };
};

module.exports = {
  escapeRegex,
  parsePagination,
  parseSort,
  buildSearchFilter,
};

