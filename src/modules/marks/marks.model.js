'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Marks – per-student marks for an Assessment or Examination-Course combination.
 */
const MarksSchema = new Schema(
  {
    student: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment', required: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true },
    semester: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },

    // ── Source: either Assessment or Examination ──────────
    assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', default: null },
    examination: { type: Schema.Types.ObjectId, ref: 'Examination', default: null },

    marksType: {
      type: String,
      enum: ['internal', 'external', 'practical', 'total', 'grace'],
      required: true,
    },

    // ── Marks data ────────────────────────────────────────
    maxMarks: { type: Number, required: true, min: 0 },
    obtainedMarks: {
      type: Number,
      required: true,
      min: 0,
      validate: {
        validator(val) {
          return this.isAbsent || this.maxMarks === undefined || val <= this.maxMarks;
        },
        message: 'obtainedMarks cannot exceed maxMarks',
      },
    },
    graceMarks: { type: Number, min: 0, default: 0 },
    effectiveMarks: { type: Number, min: 0 }, // obtained + grace

    isAbsent: { type: Boolean, default: false },
    isWithheld: { type: Boolean, default: false },

    // ── Entry & approval workflow ─────────────────────────
    enteredBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    submissionStatus: {
      type   : String,
      enum   : ['draft', 'submitted', 'approved', 'rejected'],
      default: 'draft',
    },
    submittedBy    : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    submittedAt    : { type: Date },
    verifiedBy     : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    isVerified     : { type: Boolean, default: false },
    verifiedAt     : { type: Date },
    rejectionReason: { type: String, trim: true },

    remarks: { type: String },
  },
  { timestamps: true }
);

// Pre-save: compute effectiveMarks
MarksSchema.pre('save', function (next) {
  const base = this.isAbsent ? 0 : (this.obtainedMarks || 0);
  this.effectiveMarks = Math.min(this.maxMarks, base + (this.graceMarks || 0));
  next();
});

// Include assessment and examination so multiple internal assessments in one course/semester do not collide
MarksSchema.index(
  { student: 1, course: 1, semester: 1, marksType: 1, assessment: 1, examination: 1 },
  { unique: true }
);
MarksSchema.index({ examination: 1 });
MarksSchema.index({ assessment: 1 });
MarksSchema.index({ isVerified: 1 });

const Marks = mongoose.model('Marks', MarksSchema);
module.exports = Marks;
