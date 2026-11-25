'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * AttendanceSession – one class session.
 * AttendanceRecord  – per-student record for a session.
 */

// ── Per-student record (embedded within session) ─────────────
const AttendanceRecordSchema = new Schema(
  {
    student   : { type: Schema.Types.ObjectId, ref: 'Student', required: true },
    enrollment: { type: Schema.Types.ObjectId, ref: 'Enrollment' },
    status    : {
      type    : String,
      enum    : ['present', 'absent', 'late', 'excused', 'cancelled'],
      required: true,
    },
    remarks : { type: String },
    markedAt: { type: Date, default: Date.now },
    markedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { _id: true }
);

// ── Session document ─────────────────────────────────────────
const AttendanceSchema = new Schema(
  {
    course      : { type: Schema.Types.ObjectId, ref: 'Course',      required: true },
    section     : { type: Schema.Types.ObjectId, ref: 'Section',     required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',    required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    faculty     : { type: Schema.Types.ObjectId, ref: 'Faculty',     required: true },

    date        : { type: Date,   required: true },
    dayOfWeek   : { type: String, enum: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
    sessionType : { type: String, enum: ['lecture', 'tutorial', 'practical', 'extra'], default: 'lecture' },
    periodNumber: { type: Number, required: true, min: 1, default: 1 },
    startTime   : { type: String }, // "09:00"
    endTime     : { type: String }, // "09:50"
    topic       : { type: String },

    // ── Records ───────────────────────────────────────────
    records: [AttendanceRecordSchema],

    // ── Counts (denormalised for fast summary) ────────────
    totalStudents: { type: Number, min: 0, default: 0 },
    presentCount : { type: Number, min: 0, default: 0 },
    absentCount  : { type: Number, min: 0, default: 0 },
    lateCount    : { type: Number, min: 0, default: 0 },

    isFinalized: { type: Boolean, default: false },
    finalizedAt: { type: Date },
    finalizedBy: { type: Schema.Types.ObjectId, ref: 'User' },

    remarks: { type: String },
  },
  { timestamps: true }
);

// ── Pre-save: compute attendance counts from records ─────────
AttendanceSchema.pre('save', function (next) {
  if (Array.isArray(this.records)) {
    this.totalStudents = this.records.length;
    this.presentCount  = this.records.filter((r) => r.status === 'present').length;
    this.absentCount   = this.records.filter((r) => r.status === 'absent').length;
    this.lateCount     = this.records.filter((r) => r.status === 'late').length;
  }
  next();
});

// ── Indexes ──────────────────────────────────────────────────
AttendanceSchema.index(
  { course: 1, section: 1, date: 1, periodNumber: 1, sessionType: 1 },
  { unique: true }
);
AttendanceSchema.index({ faculty: 1, date: 1 });
AttendanceSchema.index({ semester: 1, academicYear: 1 });
AttendanceSchema.index({ 'records.student': 1, date: 1 });

const Attendance = mongoose.model('Attendance', AttendanceSchema);
module.exports = Attendance;
