'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const CourseSchema = new Schema(
  {
    // ── Identification ────────────────────────────────────
    name     : { type: String, required: true, trim: true },
    code     : { type: String, required: true, trim: true, uppercase: true },
    shortName: { type: String, trim: true },

    // ── Classification ────────────────────────────────────
    department    : { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    program       : { type: Schema.Types.ObjectId, ref: 'Program',    required: true },
    semesterNumber: { type: Number, min: 1, max: 12, required: true },

    type: {
      type    : String,
      enum    : ['theory', 'practical', 'theory_practical', 'project', 'seminar', 'internship'],
      required: true,
    },
    category: {
      type   : String,
      enum   : ['core', 'elective', 'open_elective', 'audit', 'mooc', 'extra_curricular'],
      default: 'core',
    },

    // ── Credits & Marks ───────────────────────────────────
    credits         : { type: Number, required: true, min: 0, max: 10 },
    theoryCredits   : { type: Number, min: 0, default: 0 },
    practicalCredits: { type: Number, min: 0, default: 0 },

    totalMarks  : { type: Number, min: 0, default: 100 },
    passingMarks: {
      type    : Number,
      min     : 0,
      default : 40,
      validate: {
        validator(val) {
          return this.totalMarks === undefined || val <= this.totalMarks;
        },
        message: 'passingMarks cannot exceed totalMarks',
      },
    },
    internalMarks: {
      type    : Number,
      min     : 0,
      default : 30,
      validate: {
        validator(val) {
          return this.totalMarks === undefined || (val || 0) + (this.externalMarks || 0) <= this.totalMarks;
        },
        message: 'internalMarks + externalMarks cannot exceed totalMarks',
      },
    },
    externalMarks: { type: Number, min: 0, default: 70 },

    // ── Teaching Load ─────────────────────────────────────
    lectureHoursPerWeek  : { type: Number, min: 0, default: 0 },
    tutorialHoursPerWeek : { type: Number, min: 0, default: 0 },
    practicalHoursPerWeek: { type: Number, min: 0, default: 0 },

    // ── Prerequisites ─────────────────────────────────────
    prerequisites: [{ type: Schema.Types.ObjectId, ref: 'Course' }],

    // ── Status ────────────────────────────────────────────
    isActive: { type: Boolean, default: true },
    syllabus: { type: String },

    // ── Soft delete ───────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

CourseSchema.index({ code: 1 }, { unique: true });
CourseSchema.index({ department: 1, program: 1, semesterNumber: 1 });
CourseSchema.index({ isDeleted: 1 });

CourseSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Course = mongoose.model('Course', CourseSchema);
module.exports = Course;
