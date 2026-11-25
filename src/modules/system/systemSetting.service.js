'use strict';

const SystemSetting = require('./systemSetting.model');
const { SYSTEM_DEFAULTS } = require('../../config/systemDefaults');
const AppError = require('../../utils/AppError');

const validateValueMatchesType = (value, dataType) => {
  if (dataType === 'string'  && typeof value !== 'string')  return false;
  if (dataType === 'number'  && (typeof value !== 'number' || Number.isNaN(value))) return false;
  if (dataType === 'boolean' && typeof value !== 'boolean') return false;
  if (dataType === 'array'   && !Array.isArray(value))      return false;
  if (dataType === 'json'    && (typeof value !== 'object' || value === null || Array.isArray(value))) return false;
  return true;
};

const listSettings = async (query) => {
  const filter = {};
  if (query.group)               filter.group = query.group;
  if (query.isPublic !== undefined) filter.isPublic = query.isPublic;

  const docs = await SystemSetting.find(filter).sort({ group: 1, key: 1 });
  return {
    settings: docs,
    defaults: SYSTEM_DEFAULTS,
  };
};

const getPublicSettings = async () => {
  const docs = await SystemSetting.find({ isPublic: true }).select('key value dataType group label');
  const merged = {};
  for (const [k, def] of Object.entries(SYSTEM_DEFAULTS)) {
    if (def.isPublic) merged[k] = def.value;
  }
  for (const d of docs) {
    merged[d.key] = d.value;
  }
  return merged;
};

const getSettingByKey = async (key) => {
  const doc = await SystemSetting.findOne({ key });
  if (doc) return doc;
  if (SYSTEM_DEFAULTS[key]) {
    return { key, ...SYSTEM_DEFAULTS[key], isDefaultFallback: true };
  }
  throw new AppError(`System setting "${key}" not found`, 404);
};

const upsertSetting = async (payload, actorId) => {
  if (!validateValueMatchesType(payload.value, payload.dataType)) {
    throw new AppError(`Value does not match declared dataType "${payload.dataType}"`, 400);
  }

  const existing = await SystemSetting.findOne({ key: payload.key });
  if (existing && !existing.isEditable) {
    throw new AppError(`Setting "${payload.key}" is locked and cannot be edited`, 403);
  }

  return SystemSetting.findOneAndUpdate(
    { key: payload.key },
    { $set: { ...payload, updatedBy: actorId } },
    { upsert: true, new: true, runValidators: true }
  );
};

const updateSettingByKey = async (key, payload, actorId) => {
  const existing = await SystemSetting.findOne({ key });
  const defaultMeta = SYSTEM_DEFAULTS[key];

  if (existing && !existing.isEditable) {
    throw new AppError(`Setting "${key}" is locked and cannot be edited`, 403);
  }

  const dataType = payload.dataType || existing?.dataType || defaultMeta?.dataType;
  if (!dataType) {
    throw new AppError(`Unknown setting "${key}". Provide dataType or create via POST /settings.`, 400);
  }
  if (!validateValueMatchesType(payload.value, dataType)) {
    throw new AppError(`Value does not match dataType "${dataType}"`, 400);
  }

  const updateDoc = {
    key,
    value      : payload.value,
    dataType,
    group      : payload.group       ?? existing?.group       ?? defaultMeta?.group ?? 'general',
    label      : payload.label       ?? existing?.label       ?? defaultMeta?.label,
    description: payload.description ?? existing?.description ?? defaultMeta?.description,
    isPublic   : payload.isPublic    ?? existing?.isPublic    ?? defaultMeta?.isPublic ?? false,
    updatedBy  : actorId,
  };

  return SystemSetting.findOneAndUpdate(
    { key },
    { $set: updateDoc },
    { upsert: true, new: true, runValidators: true }
  );
};

module.exports = {
  listSettings,
  getPublicSettings,
  getSettingByKey,
  upsertSetting,
  updateSettingByKey,
};

