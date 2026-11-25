'use strict';

const SystemSetting = require('./systemSetting.model');
const { SYSTEM_DEFAULTS } = require('../../config/systemDefaults');

/**
 * Retrieve a single setting value from MongoDB SystemSetting, falling back to SYSTEM_DEFAULTS.
 */
const getSettingValue = async (key, fallbackOverride = undefined) => {
  const doc = await SystemSetting.findOne({ key }).lean();
  if (doc) return doc.value;
  if (fallbackOverride !== undefined) return fallbackOverride;
  return SYSTEM_DEFAULTS[key]?.value;
};

/**
 * Retrieve configured attendance policy from SystemSetting + defaults.
 */
const getAttendancePolicy = async () => {
  const keys = [
    'attendance.minimumPercentage',
    'attendance.lateCountsAsPresent',
    'attendance.editWindowHours',
  ];
  const docs = await SystemSetting.find({ key: { $in: keys } }).lean();
  const map  = Object.fromEntries(docs.map((d) => [d.key, d.value]));

  return {
    minimumPercentage  : Number(map['attendance.minimumPercentage'] ?? SYSTEM_DEFAULTS['attendance.minimumPercentage'].value),
    lateCountsAsPresent: Boolean(map['attendance.lateCountsAsPresent'] ?? SYSTEM_DEFAULTS['attendance.lateCountsAsPresent'].value),
    editWindowHours    : Number(map['attendance.editWindowHours'] ?? SYSTEM_DEFAULTS['attendance.editWindowHours'].value),
  };
};

/**
 * Retrieve configured grading rules from SystemSetting + defaults.
 */
const getGradingPolicy = async () => {
  const keys = ['grading.passingPercentage', 'grading.maxGraceMarks', 'grading.scale'];
  const docs = await SystemSetting.find({ key: { $in: keys } }).lean();
  const map  = Object.fromEntries(docs.map((d) => [d.key, d.value]));

  return {
    passingPercentage: Number(map['grading.passingPercentage'] ?? SYSTEM_DEFAULTS['grading.passingPercentage'].value),
    maxGraceMarks    : Number(map['grading.maxGraceMarks'] ?? SYSTEM_DEFAULTS['grading.maxGraceMarks'].value),
    scale            : Array.isArray(map['grading.scale']) && map['grading.scale'].length > 0
      ? map['grading.scale']
      : SYSTEM_DEFAULTS['grading.scale'].value,
  };
};

module.exports = {
  getSettingValue,
  getAttendancePolicy,
  getGradingPolicy,
};

