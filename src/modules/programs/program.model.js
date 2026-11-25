'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SemesterConfigSchema = new Schema(
  {
    semesterNumber: { type: Number, required: true, min: 1, max: 12 },
    maxCredits    : { type: Number, min: 0, default: 30 },
    minCredits    : { type: Number, min: 0, default: 15 },
  },
  { _id: false }
);

const ProgramSchema = new Schema(
  {
    name       : { type: String, required: true, trim: true, maxlength: 150 },
    code       : { type: String, required: true, trim: true, uppercase: true },
    shortName  : { type: String, trim: true },
    department : { type: Schema.Types.ObjectId, ref: 'Department', required: true },

    type: {
      type    : String,
      enum    : ['undergraduate', 'postgraduate', 'doctoral', 'diploma', 'certificate'],
      required: true,
    },
    duration      : { type: Number, required: true, min: 1, max: 10 }, // in years
    totalSemesters: { type: Number, required: true, min: 1, max: 20 },
    totalCredits  : { type: Number, min: 0 },
    description   : { type: String },

    semesterConfig: [SemesterConfigSchema],

    eligibilityCriteria: { type: String },
    isActive           : { type: Boolean, default: true },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

ProgramSchema.index({ code: 1 }, { unique: true });
ProgramSchema.index({ department: 1, type: 1 });
ProgramSchema.index({ isDeleted: 1 });

ProgramSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Program = mongoose.model('Program', ProgramSchema);
module.exports = Program;
