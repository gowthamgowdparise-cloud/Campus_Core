'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Fee component (e.g., Tuition, Lab, Library, Hostel) */
const FeeComponentSchema = new Schema(
  {
    name       : { type: String, required: true, trim: true },
    amount     : { type: Number, required: true, min: 0 },
    isMandatory: { type: Boolean, default: true },
    description: { type: String },
  },
  { _id: false }
);

/** Master fee structure for a program/year */
const FeeStructureSchema = new Schema(
  {
    name        : { type: String, required: true, trim: true },
    program     : { type: Schema.Types.ObjectId, ref: 'Program',      required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    year        : { type: Number, min: 1, max: 6, required: true },
    category    : { type: String, enum: ['general', 'obc', 'sc_st', 'nri', 'management'], default: 'general' },

    components  : [FeeComponentSchema],

    totalAmount   : { type: Number, required: true, min: 0 },
    lateFinePerDay: { type: Number, min: 0, default: 0 },
    dueDate       : { type: Date },

    isActive : { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true }
);

FeeStructureSchema.index({ program: 1, academicYear: 1, year: 1, category: 1 }, { unique: true });
FeeStructureSchema.index({ isActive: 1 });

const FeeStructure = mongoose.model('FeeStructure', FeeStructureSchema);
module.exports = FeeStructure;
