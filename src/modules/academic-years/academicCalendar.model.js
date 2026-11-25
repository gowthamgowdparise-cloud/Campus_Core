'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * AcademicCalendarEvent – institutional calendar entries (holidays, deadlines, exams, events).
 */
const AcademicCalendarEventSchema = new Schema(
  {
    title       : { type: String, required: true, trim: true, maxlength: 180 },
    description : { type: String, trim: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',     default: null },
    department  : { type: Schema.Types.ObjectId, ref: 'Department',   default: null },
    eventType   : {
      type    : String,
      enum    : ['holiday', 'exam', 'registration', 'orientation', 'vacation', 'convocation', 'deadline', 'academic_event'],
      required: true,
    },
    startDate: { type: Date, required: true },
    endDate  : {
      type    : Date,
      required: true,
      validate: {
        validator(val) {
          return !this.startDate || !val || val >= this.startDate;
        },
        message: 'endDate must be on or after startDate',
      },
    },
    isHoliday  : { type: Boolean, default: false },
    targetRoles: [{ type: String, enum: ['all', 'admin', 'faculty', 'student'] }],
    createdBy  : { type: Schema.Types.ObjectId, ref: 'User', required: true },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

AcademicCalendarEventSchema.index({ academicYear: 1, startDate: 1 });
AcademicCalendarEventSchema.index({ semester: 1, eventType: 1 });
AcademicCalendarEventSchema.index({ isDeleted: 1 });

AcademicCalendarEventSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const AcademicCalendarEvent = mongoose.model('AcademicCalendarEvent', AcademicCalendarEventSchema);
module.exports = AcademicCalendarEvent;

