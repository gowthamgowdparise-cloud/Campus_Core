'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * SystemSetting – key-value store for configurable system parameters.
 * Admin-managed, not hardcoded.
 */
const SystemSettingSchema = new Schema(
  {
    key        : { type: String, required: true, trim: true },
    value      : { type: Schema.Types.Mixed, required: true },
    dataType   : { type: String, enum: ['string', 'number', 'boolean', 'json', 'array'], required: true },
    group      : { type: String, trim: true }, // 'attendance', 'fee', 'exam', etc.
    label      : { type: String },
    description: { type: String },
    isPublic   : { type: Boolean, default: false }, // available without auth?
    isEditable : { type: Boolean, default: true },
    updatedBy  : { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

SystemSettingSchema.index({ key: 1 }, { unique: true });
SystemSettingSchema.index({ group: 1 });

const SystemSetting = mongoose.model('SystemSetting', SystemSettingSchema);
module.exports = SystemSetting;
