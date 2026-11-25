'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * AttendanceCorrectionRequest – workflow for student/faculty attendance correction requests.
 */
const AttendanceCorrectionRequestSchema = new Schema(
  {
    attendanceSession: { type: Schema.Types.ObjectId, ref: 'Attendance', required: true },
    student          : { type: Schema.Types.ObjectId, ref: 'Student',    required: true },
    course           : { type: Schema.Types.ObjectId, ref: 'Course',     required: true },
    section          : { type: Schema.Types.ObjectId, ref: 'Section',    required: true },
    semester         : { type: Schema.Types.ObjectId, ref: 'Semester',   required: true },
    requestedBy      : { type: Schema.Types.ObjectId, ref: 'User',       required: true },
    requesterRole    : { type: String, enum: ['student', 'faculty', 'admin'], required: true },

    currentStatus  : { type: String, enum: ['present', 'absent', 'late', 'excused', 'cancelled'], required: true },
    requestedStatus: { type: String, enum: ['present', 'absent', 'late', 'excused'], required: true },
    reason         : { type: String, required: true, trim: true, maxlength: 1000 },
    supportingDocumentUrl: { type: String, trim: true },

    status       : { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy   : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt   : { type: Date },
    reviewRemarks: { type: String, trim: true },
  },
  { timestamps: true }
);

AttendanceCorrectionRequestSchema.index({ attendanceSession: 1, student: 1, status: 1 });
AttendanceCorrectionRequestSchema.index({ student: 1, createdAt: -1 });
AttendanceCorrectionRequestSchema.index({ course: 1, section: 1, status: 1 });

const AttendanceCorrectionRequest = mongoose.model(
  'AttendanceCorrectionRequest',
  AttendanceCorrectionRequestSchema
);
module.exports = AttendanceCorrectionRequest;

