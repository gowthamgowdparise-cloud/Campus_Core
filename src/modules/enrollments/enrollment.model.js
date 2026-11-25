'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * Enrollment – many-to-many between Student and Course for a given semester/section.
 * Acts as the junction record. Marked historical-safe (never hard-deleted).
 */
const EnrollmentSchema = new Schema(
  {
    student     : { type: Schema.Types.ObjectId, ref: 'Student',     required: true },
    course      : { type: Schema.Types.ObjectId, ref: 'Course',      required: true },
    section     : { type: Schema.Types.ObjectId, ref: 'Section',     required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',    required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    faculty     : { type: Schema.Types.ObjectId, ref: 'Faculty',     default: null },

    // ── Enrollment state ──────────────────────────────────
    status: {
      type   : String,
      enum   : ['enrolled', 'dropped', 'completed', 'failed', 'incomplete', 'exempted'],
      default: 'enrolled',
    },
    enrolledAt: { type: Date, default: Date.now },
    droppedAt : { type: Date },
    dropReason: { type: String },

    // ── Eligibility ───────────────────────────────────────
    isEligibleForExam  : { type: Boolean, default: true },
    ineligibilityReason: { type: String },

    // ── Shorthand attendance summary (denormalised) ───────
    attendancePercentage: { type: Number, min: 0, max: 100, default: 0 },
  },
  { timestamps: true }
);

// ── Compound unique: a student can enroll in a course in a semester only once
EnrollmentSchema.index({ student: 1, course: 1, semester: 1 }, { unique: true });
EnrollmentSchema.index({ course: 1, semester: 1 });
EnrollmentSchema.index({ section: 1, semester: 1 });
EnrollmentSchema.index({ faculty: 1, semester: 1 });
EnrollmentSchema.index({ status: 1 });
EnrollmentSchema.index({ academicYear: 1 });

const Enrollment = mongoose.model('Enrollment', EnrollmentSchema);
module.exports = Enrollment;
