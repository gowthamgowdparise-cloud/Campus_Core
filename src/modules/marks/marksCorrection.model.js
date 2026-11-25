'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * MarksCorrectionRequest – workflow for student/faculty marks correction or re-evaluation requests.
 */
const MarksCorrectionRequestSchema = new Schema(
  {
    marksRecord  : { type: Schema.Types.ObjectId, ref: 'Marks',    required: true },
    student      : { type: Schema.Types.ObjectId, ref: 'Student',  required: true },
    course       : { type: Schema.Types.ObjectId, ref: 'Course',   required: true },
    semester     : { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
    requestedBy  : { type: Schema.Types.ObjectId, ref: 'User',     required: true },
    requesterRole: { type: String, enum: ['student', 'faculty', 'admin'], required: true },

    currentMarks  : { type: Number, required: true, min: 0 },
    requestedMarks: { type: Number, min: 0, default: null },
    reason        : { type: String, required: true, trim: true, maxlength: 1000 },

    status       : { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
    reviewedBy   : { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt   : { type: Date },
    reviewRemarks: { type: String, trim: true },
  },
  { timestamps: true }
);

MarksCorrectionRequestSchema.index({ marksRecord: 1, status: 1 });
MarksCorrectionRequestSchema.index({ student: 1, createdAt: -1 });
MarksCorrectionRequestSchema.index({ course: 1, semester: 1, status: 1 });

const MarksCorrectionRequest = mongoose.model('MarksCorrectionRequest', MarksCorrectionRequestSchema);
module.exports = MarksCorrectionRequest;

