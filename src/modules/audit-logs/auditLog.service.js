'use strict';

const AuditLog = require('./auditLog.model');
const AppError = require('../../utils/AppError');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination, buildSearchFilter } = require('../../utils/queryHelpers');

const listAuditLogs = async (query) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.actor)      filter.actor = query.actor;
  if (query.actorRole)  filter.actorRole = query.actorRole;
  if (query.action)     filter.action = query.action;
  if (query.module)     filter.module = query.module;
  if (query.entityType) filter.entityType = query.entityType;
  if (query.status)     filter.status = query.status;

  if (query.from || query.to) {
    filter.createdAt = {};
    if (query.from) filter.createdAt.$gte = new Date(query.from);
    if (query.to)   filter.createdAt.$lte = new Date(query.to);
  }

  const searchFilter = buildSearchFilter(query.search, ['actorEmail', 'action', 'module', 'endpoint']);
  if (searchFilter) Object.assign(filter, searchFilter);

  const [logs, total] = await Promise.all([
    AuditLog.find(filter)
      .populate('actor', 'firstName lastName email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  return { logs, meta: buildPaginationMeta({ page, limit, total }) };
};

const getAuditLogById = async (id) => {
  const log = await AuditLog.findById(id).populate('actor', 'firstName lastName email role').lean();
  if (!log) throw new AppError('Audit log entry not found', 404);
  return log;
};

module.exports = { listAuditLogs, getAuditLogById };

