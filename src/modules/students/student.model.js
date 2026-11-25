'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Address Sub-schema ───────────────────────────────────────
const AddressSchema = new Schema(
  {
    street: { type: String, trim: true },
    city: { type: String, trim: true },
    state: { type: String, trim: true },
    country: { type: String, trim: true, default: 'India' },
    pincode: { type: String, trim: true },
  },
  { _id: false }
);

// ── Guardian Sub-schema ──────────────────────────────────────
const GuardianSchema = new Schema(
  {
    name: { type: String, trim: true },
    relationship: { type: String, enum: ['father', 'mother', 'guardian', 'other'] },
    phone: { type: String, trim: true },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid guardian email'],
    },
    occupation: { type: String, trim: true },
    annualIncome: { type: Number, min: 0 },
  },
  { _id: false }
);

// ── Academic History Entry ───────────────────────────────────
const PreviousQualificationSchema = new Schema(
  {
    level: { type: String }, // "10th", "12th", "Diploma", etc.
    institution: { type: String },
    board: { type: String },
    passingYear: { type: Number, min: 1950, max: 2100 },
    percentage: { type: Number, min: 0, max: 100 },
    subjects: [{ type: String }],
  },
  { _id: false }
);

// ── Main Student Schema ──────────────────────────────────────
const StudentSchema = new Schema(
  {
    // ── Core references ───────────────────────────────────
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },
    program: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    currentSection: { type: Schema.Types.ObjectId, ref: 'Section', default: null },

    // ── Identifiers ───────────────────────────────────────
    rollNumber: { type: String, required: true, trim: true },
    enrollmentNumber: { type: String, trim: true },
    admissionNumber: { type: String, trim: true },

    // ── Personal ──────────────────────────────────────────
    bloodGroup: { type: String, enum: ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'] },
    nationality: { type: String, default: 'Indian', trim: true },
    religion: { type: String, trim: true },
    caste: { type: String, enum: ['General', 'OBC', 'SC', 'ST', 'EWS', 'Other'] },
    motherTongue: { type: String, trim: true },
    isPhysicallyHandicapped: { type: Boolean, default: false },
    disabilityDetails: { type: String },

    // ── Admission ─────────────────────────────────────────
    admissionDate: { type: Date, required: true },
    admissionType: { type: String, enum: ['regular', 'lateral', 'transfer', 'nri'], default: 'regular' },
    currentSemester: { type: Number, min: 1, max: 12, default: 1 },
    currentYear: { type: Number, min: 1, max: 6, default: 1 },
    batchYear: { type: Number, required: true, min: 1950, max: 2100 },

    // ── Status ────────────────────────────────────────────
    status: {
      type: String,
      enum: ['active', 'inactive', 'graduated', 'withdrawn', 'transferred', 'detained'],
      default: 'active',
    },
    graduationDate: { type: Date },

    // ── Contact ───────────────────────────────────────────
    presentAddress: { type: AddressSchema },
    permanentAddress: { type: AddressSchema },
    guardian: { type: GuardianSchema },

    // ── Academics ─────────────────────────────────────────
    previousQualifications: [PreviousQualificationSchema],
    cgpa: { type: Number, min: 0, max: 10, default: 0 },
    totalCreditsEarned: { type: Number, min: 0, default: 0 },

    // ── Documents ─────────────────────────────────────────
    documents: [{ type: Schema.Types.ObjectId, ref: 'Document' }],

    // ── Soft delete ───────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────
StudentSchema.index({ rollNumber: 1 }, { unique: true });
StudentSchema.index({ enrollmentNumber: 1 }, { unique: true, sparse: true });
StudentSchema.index({ admissionNumber: 1 }, { unique: true, sparse: true });
StudentSchema.index({ user: 1 }, { unique: true });
StudentSchema.index({ department: 1, program: 1, currentSemester: 1 });
StudentSchema.index({ batchYear: 1, status: 1 });
StudentSchema.index({ isDeleted: 1 });

// ── Default filter ───────────────────────────────────────────
StudentSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Student = mongoose.model('Student', StudentSchema);
module.exports = Student;
