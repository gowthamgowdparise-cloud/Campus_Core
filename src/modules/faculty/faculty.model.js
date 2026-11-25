'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

// ── Qualification Sub-schema ─────────────────────────────────
const QualificationSchema = new Schema(
  {
    degree     : { type: String, required: true }, // "M.Tech", "PhD", etc.
    field      : { type: String },
    institution: { type: String },
    passingYear: { type: Number, min: 1950, max: 2100 },
    grade      : { type: String },
  },
  { _id: false }
);

// ── Experience Sub-schema ────────────────────────────────────
const ExperienceSchema = new Schema(
  {
    organization    : { type: String },
    designation     : { type: String },
    from            : { type: Date },
    to              : { type: Date }, // null = current
    responsibilities: { type: String },
  },
  { _id: false }
);

// ── Main Faculty Schema ──────────────────────────────────────
const FacultySchema = new Schema(
  {
    // ── Core references ───────────────────────────────────
    user      : { type: Schema.Types.ObjectId, ref: 'User',       required: true },
    department: { type: Schema.Types.ObjectId, ref: 'Department', required: true },

    // ── Identifiers ───────────────────────────────────────
    employeeId : { type: String, required: true, trim: true },
    facultyCode: { type: String, trim: true },

    // ── Professional ──────────────────────────────────────
    designation: {
      type    : String,
      enum    : ['professor', 'associate_professor', 'assistant_professor', 'lecturer', 'visiting_faculty', 'adjunct_faculty'],
      required: true,
    },
    specialization      : [{ type: String }],
    qualifications      : [QualificationSchema],
    experience          : [ExperienceSchema],
    totalExperienceYears: { type: Number, min: 0, default: 0 },

    // ── Employment ────────────────────────────────────────
    employmentType: {
      type   : String,
      enum   : ['permanent', 'contract', 'visiting', 'temporary'],
      default: 'permanent',
    },
    joiningDate  : { type: Date, required: true },
    relievingDate: { type: Date },

    // ── Responsibility ────────────────────────────────────
    isHOD         : { type: Boolean, default: false },
    hodSince      : { type: Date },
    isClassTeacher: { type: Boolean, default: false },
    classTeacherOf: { type: Schema.Types.ObjectId, ref: 'Section', default: null },

    // ── Research ─────────────────────────────────────────
    researchInterests: [{ type: String }],
    publications     : { type: Number, min: 0, default: 0 },

    // ── Status ────────────────────────────────────────────
    status: {
      type   : String,
      enum   : ['active', 'on_leave', 'resigned', 'terminated'],
      default: 'active',
    },

    // ── Soft delete ───────────────────────────────────────
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  {
    timestamps: true,
    toJSON    : { virtuals: true },
    toObject  : { virtuals: true },
  }
);

// ── Indexes ──────────────────────────────────────────────────
FacultySchema.index({ employeeId: 1 },  { unique: true });
FacultySchema.index({ facultyCode: 1 }, { unique: true, sparse: true });
FacultySchema.index({ user: 1 },        { unique: true });
FacultySchema.index({ department: 1, designation: 1 });
FacultySchema.index({ isHOD: 1, department: 1 });
FacultySchema.index({ isDeleted: 1 });

// ── Default filter ───────────────────────────────────────────
FacultySchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const Faculty = mongoose.model('Faculty', FacultySchema);
module.exports = Faculty;
