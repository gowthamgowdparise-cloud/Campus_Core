'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/** One period/slot on the timetable */
const PeriodSchema = new Schema(
  {
    periodNumber: { type: Number, required: true, min: 1 },
    startTime   : { type: String, required: true }, // "09:00"
    endTime     : { type: String, required: true }, // "09:50"
    course      : { type: Schema.Types.ObjectId, ref: 'Course',  default: null },
    faculty     : { type: Schema.Types.ObjectId, ref: 'Faculty', default: null },
    room        : { type: String },
    type        : { type: String, enum: ['lecture', 'tutorial', 'practical', 'break', 'lunch', 'free'], default: 'lecture' },
  },
  { _id: false }
);

/** One day row */
const DayScheduleSchema = new Schema(
  {
    day    : { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], required: true },
    periods: [PeriodSchema],
  },
  { _id: false }
);

const TimetableSchema = new Schema(
  {
    section     : { type: Schema.Types.ObjectId, ref: 'Section',     required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',    required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },

    effectiveFrom: { type: Date, required: true },
    effectiveTo  : {
      type    : Date,
      validate: {
        validator(val) {
          return !this.effectiveFrom || !val || val >= this.effectiveFrom;
        },
        message: 'effectiveTo must be on or after effectiveFrom',
      },
    },
    isActive: { type: Boolean, default: true },

    schedule: [DayScheduleSchema],

    createdBy : { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    status    : { type: String, enum: ['draft', 'published', 'archived'], default: 'draft' },
  },
  { timestamps: true }
);

TimetableSchema.index({ section: 1, semester: 1, isActive: 1 });
TimetableSchema.index({ academicYear: 1 });
TimetableSchema.index({ 'schedule.periods.faculty': 1 });

const Timetable = mongoose.model('Timetable', TimetableSchema);
module.exports = Timetable;
