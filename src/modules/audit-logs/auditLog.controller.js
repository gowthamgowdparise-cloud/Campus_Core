'use strict';

const auditLogService = require('./auditLog.service');
const catchAsync      = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { logs, meta } = await auditLogService.listAuditLogs(req.query);
  sendSuccess(res, 200, 'Audit logs retrieved successfully', logs, meta);
});

const getById = catchAsync(async (req, res) => {
  const log = await auditLogService.getAuditLogById(req.params.id);
  sendSuccess(res, 200, 'Audit log retrieved successfully', log);
});

module.exports = { list, getById };

