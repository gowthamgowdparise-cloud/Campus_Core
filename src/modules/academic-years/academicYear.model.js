'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const AcademicYearSchema = new Schema(
  {
    name     : { type: String, required: true, trim: true }, // "2024-25"
    startDate: { type: Date,   required: true },
    endDate  : {
      type    : Date,
      required: true,
      validate: {
        validator(val) {
          return !this.startDate || !val || val > this.startDate;
        },
        message: 'endDate must be after startDate',
      },
    },
    isCurrent  : { type: Boolean, default: false },
    status     : { type: String, enum: ['upcoming', 'active', 'completed'], default: 'upcoming' },
    description: { type: String },
  },
  { timestamps: true }
);

AcademicYearSchema.index({ name: 1 }, { unique: true });
AcademicYearSchema.index({ isCurrent: 1 });
AcademicYearSchema.index({ status: 1 });
AcademicYearSchema.index({ startDate: 1, endDate: 1 });

// Enforce single isCurrent=true
AcademicYearSchema.pre('save', async function (next) {
  if (this.isCurrent && this.isModified('isCurrent')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isCurrent: false } }
    );
  }
  next();
});

const AcademicYear = mongoose.model('AcademicYear', AcademicYearSchema);
module.exports = AcademicYear;
