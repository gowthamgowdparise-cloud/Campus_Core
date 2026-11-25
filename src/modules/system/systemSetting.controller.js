'use strict';

const settingService = require('./systemSetting.service');
const catchAsync     = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const data = await settingService.listSettings(req.query);
  sendSuccess(res, 200, 'System settings retrieved successfully', data);
});

const getPublic = catchAsync(async (_req, res) => {
  const data = await settingService.getPublicSettings();
  sendSuccess(res, 200, 'Public system settings retrieved successfully', data);
});

const getByKey = catchAsync(async (req, res) => {
  const data = await settingService.getSettingByKey(req.params.key);
  sendSuccess(res, 200, 'System setting retrieved successfully', data);
});

const upsert = catchAsync(async (req, res) => {
  const data = await settingService.upsertSetting(req.body, req.user.id);
  sendSuccess(res, 201, 'System setting saved successfully', data);
});

const updateByKey = catchAsync(async (req, res) => {
  const data = await settingService.updateSettingByKey(req.params.key, req.body, req.user.id);
  sendSuccess(res, 200, 'System setting updated successfully', data);
});

module.exports = { list, getPublic, getByKey, upsert, updateByKey };

