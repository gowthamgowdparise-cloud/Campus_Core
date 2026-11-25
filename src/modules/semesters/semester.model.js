'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SemesterSchema = new Schema(
  {
    name          : { type: String, required: true, trim: true }, // "Odd 2024-25"
    academicYear  : { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    type          : { type: String, enum: ['odd', 'even', 'summer'], required: true },
    semesterNumber: { type: Number, min: 1, max: 12 },
    startDate     : { type: Date,   required: true },
    endDate       : {
      type    : Date,
      required: true,
      validate: {
        validator(val) {
          return !this.startDate || !val || val > this.startDate;
        },
        message: 'endDate must be after startDate',
      },
    },
    examStartDate: { type: Date },
    examEndDate  : {
      type    : Date,
      validate: {
        validator(val) {
          return !this.examStartDate || !val || val >= this.examStartDate;
        },
        message: 'examEndDate must be on or after examStartDate',
      },
    },
    isCurrent: { type: Boolean, default: false },
    status   : {
      type   : String,
      enum   : ['upcoming', 'ongoing', 'exam_period', 'completed'],
      default: 'upcoming',
    },
  },
  { timestamps: true }
);

SemesterSchema.index({ academicYear: 1, type: 1 }, { unique: true });
SemesterSchema.index({ isCurrent: 1 });
SemesterSchema.index({ status: 1 });

SemesterSchema.pre('save', async function (next) {
  if (this.isCurrent && this.isModified('isCurrent')) {
    await this.constructor.updateMany(
      { _id: { $ne: this._id } },
      { $set: { isCurrent: false } }
    );
  }
  next();
});

const Semester = mongoose.model('Semester', SemesterSchema);
module.exports = Semester;
