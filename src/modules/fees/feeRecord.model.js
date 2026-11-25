'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/** Student's individual fee record (demand) for a semester */
const FeeRecordSchema = new Schema(
  {
    student     : { type: Schema.Types.ObjectId, ref: 'Student',      required: true },
    feeStructure: { type: Schema.Types.ObjectId, ref: 'FeeStructure', required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',     default: null },

    // ── Demand ────────────────────────────────────────────
    totalDemand: { type: Number, required: true, min: 0 },
    totalPaid  : { type: Number, default: 0, min: 0 },
    totalDue   : { type: Number, default: 0, min: 0 },
    lateFine   : { type: Number, default: 0, min: 0 },

    dueDate : { type: Date },
    payments: [{ type: Schema.Types.ObjectId, ref: 'Payment' }],

    status: {
      type   : String,
      enum   : ['pending', 'partial', 'paid', 'overdue', 'waived', 'refunded'],
      default: 'pending',
    },

    // ── Concession/Scholarship ────────────────────────────
    concessionAmount: { type: Number, min: 0, default: 0 },
    concessionReason: { type: String },
    isScholarship   : { type: Boolean, default: false },

    remarks  : { type: String },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

FeeRecordSchema.index({ student: 1, academicYear: 1, semester: 1 }, { unique: true });
FeeRecordSchema.index({ status: 1 });
FeeRecordSchema.index({ dueDate: 1, status: 1 });

// Auto-compute totalDue and sync payment status before save
FeeRecordSchema.pre('save', function (next) {
  this.totalDue = Math.max(
    0,
    (this.totalDemand || 0) - (this.totalPaid || 0) - (this.concessionAmount || 0) + (this.lateFine || 0)
  );
  if (!['waived', 'refunded'].includes(this.status)) {
    if (this.totalDue === 0 && (this.totalPaid > 0 || this.concessionAmount >= this.totalDemand)) {
      this.status = 'paid';
    } else if (this.totalPaid > 0 && this.totalDue > 0) {
      this.status = 'partial';
    }
  }
  next();
});

const FeeRecord = mongoose.model('FeeRecord', FeeRecordSchema);
module.exports = FeeRecord;
