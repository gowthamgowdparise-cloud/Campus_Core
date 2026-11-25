'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const ExamScheduleSlotSchema = new Schema(
  {
    course      : { type: Schema.Types.ObjectId, ref: 'Course',  required: true },
    examDate    : { type: Date,   required: true },
    startTime   : { type: String, required: true, trim: true }, // "10:00"
    endTime     : { type: String, required: true, trim: true }, // "13:00"
    room        : { type: String, trim: true },
    maxMarks    : { type: Number, min: 0, default: 100 },
    passingMarks: { type: Number, min: 0, default: 40 },
    invigilator : { type: Schema.Types.ObjectId, ref: 'Faculty', default: null },
  },
  { _id: true }
);

const ExaminationSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: ['internal', 'mid_term', 'end_term', 'practical', 'viva', 'project', 'supplementary', 'improvement'],
      required: true,
    },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
    program: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },

    startDate: { type: Date, required: true },
    endDate: {
      type: Date,
      required: true,
      validate: {
        validator(val) {
          return !this.startDate || !val || val >= this.startDate;
        },
        message: 'endDate must be on or after startDate',
      },
    },

    status: {
      type: String,
      enum: ['scheduled', 'ongoing', 'completed', 'result_declared', 'cancelled'],
      default: 'scheduled',
    },

    passingPercentage: { type: Number, min: 0, max: 100, default: 40 },
    maxGraceMark: { type: Number, min: 0, default: 0 },

    examSchedule: { type: [ExamScheduleSlotSchema], default: [] },

    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },

    remarks: { type: String },
  },
  { timestamps: true }
);

ExaminationSchema.index({ academicYear: 1, semester: 1, type: 1 });
ExaminationSchema.index({ department: 1, program: 1 });
ExaminationSchema.index({ status: 1 });

const Examination = mongoose.model('Examination', ExaminationSchema);
module.exports = Examination;
