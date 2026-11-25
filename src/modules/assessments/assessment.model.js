'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Assessment – internal assessment component (quiz, assignment, lab, etc.)
 */
const AssessmentSchema = new Schema(
  {
    title       : { type: String, required: true, trim: true },
    course      : { type: Schema.Types.ObjectId, ref: 'Course',      required: true },
    section     : { type: Schema.Types.ObjectId, ref: 'Section',     required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',    required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    faculty     : { type: Schema.Types.ObjectId, ref: 'Faculty',     required: true },
    examination : { type: Schema.Types.ObjectId, ref: 'Examination', default: null },

    type: {
      type    : String,
      enum    : ['quiz', 'assignment', 'lab_report', 'project', 'presentation', 'viva', 'class_test', 'other'],
      required: true,
    },
    maxMarks    : { type: Number, required: true, min: 0 },
    passingMarks: {
      type    : Number,
      min     : 0,
      default : 0,
      validate: {
        validator(val) {
          return this.maxMarks === undefined || val <= this.maxMarks;
        },
        message: 'passingMarks cannot exceed maxMarks',
      },
    },
    weightage: { type: Number, min: 0, max: 100, default: 100 }, // % of internal marks

    scheduledDate : { type: Date },
    submissionDate: { type: Date },

    status: {
      type   : String,
      enum   : ['draft', 'published', 'ongoing', 'completed', 'cancelled'],
      default: 'draft',
    },
    instructions: { type: String },
    isGraded    : { type: Boolean, default: false },
  },
  { timestamps: true }
);

AssessmentSchema.index({ course: 1, section: 1, semester: 1 });
AssessmentSchema.index({ faculty: 1, semester: 1 });
AssessmentSchema.index({ status: 1 });

const Assessment = mongoose.model('Assessment', AssessmentSchema);
module.exports = Assessment;
