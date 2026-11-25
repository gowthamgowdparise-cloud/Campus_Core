'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Per-course result within a semester result card */
const CourseResultSchema = new Schema(
  {
    course       : { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    enrollment   : { type: Schema.Types.ObjectId, ref: 'Enrollment' },
    internalMarks: { type: Number, min: 0, default: 0 },
    externalMarks: { type: Number, min: 0, default: 0 },
    totalMarks   : { type: Number, min: 0, default: 0 },
    maxMarks     : { type: Number, min: 0, default: 100 },
    percentage   : { type: Number, min: 0, max: 100, default: 0 },
    gradePoint   : { type: Number, min: 0, max: 10, default: 0 },
    grade        : { type: String },
    credits      : { type: Number, min: 0, default: 0 },
    creditPoints : { type: Number, min: 0, default: 0 }, // gradePoint × credits
    status       : { type: String, enum: ['pass', 'fail', 'absent', 'withheld', 'exempted'], default: 'pass' },
    isBacklog    : { type: Boolean, default: false },
    attempts     : { type: Number, min: 1, default: 1 },
  },
  { _id: false }
);

const ResultSchema = new Schema(
  {
    student     : { type: Schema.Types.ObjectId, ref: 'Student',     required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',    required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    examination : { type: Schema.Types.ObjectId, ref: 'Examination', default: null },

    courseResults: [CourseResultSchema],

    // ── Semester summary ──────────────────────────────────
    totalCreditsRegistered: { type: Number, min: 0, default: 0 },
    totalCreditsEarned    : { type: Number, min: 0, default: 0 },
    totalCreditPoints     : { type: Number, min: 0, default: 0 },
    sgpa                  : { type: Number, min: 0, max: 10, default: 0 }, // semester GPA
    cgpa                  : { type: Number, min: 0, max: 10, default: 0 }, // cumulative GPA

    totalBacklogs : { type: Number, min: 0, default: 0 },
    activeBacklogs: { type: Number, min: 0, default: 0 },
    resultStatus  : {
      type   : String,
      enum   : ['pass', 'fail', 'withheld', 'promoted', 'detained'],
      default: 'pass',
    },
    isPublished: { type: Boolean, default: false },
    publishedAt: { type: Date },
    publishedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    remarks: { type: String },
  },
  { timestamps: true }
);

ResultSchema.index({ student: 1, semester: 1 }, { unique: true });
ResultSchema.index({ academicYear: 1, semester: 1 });
ResultSchema.index({ isPublished: 1 });

const Result = mongoose.model('Result', ResultSchema);
module.exports = Result;
