'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

const SectionSchema = new Schema(
  {
    name           : { type: String, required: true, trim: true },   // "A", "B", "CS-3A"
    program        : { type: Schema.Types.ObjectId, ref: 'Program',      required: true },
    department     : { type: Schema.Types.ObjectId, ref: 'Department',   required: true },
    academicYear   : { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    semester       : { type: Schema.Types.ObjectId, ref: 'Semester',     required: true },
    year           : { type: Number, min: 1, max: 6, required: true },
    semesterNumber : { type: Number, min: 1, max: 12 },
    classTeacher   : { type: Schema.Types.ObjectId, ref: 'Faculty',  default: null },
    maxStrength    : { type: Number, min: 1, default: 60 },
    currentStrength: {
      type    : Number,
      min     : 0,
      default : 0,
      validate: {
        validator(val) {
          return this.maxStrength === undefined || val <= this.maxStrength;
        },
        message: 'currentStrength cannot exceed maxStrength',
      },
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

SectionSchema.index({ program: 1, academicYear: 1, semester: 1, name: 1 }, { unique: true });
SectionSchema.index({ department: 1, academicYear: 1 });
SectionSchema.index({ classTeacher: 1 });

const Section = mongoose.model('Section', SectionSchema);
module.exports = Section;
