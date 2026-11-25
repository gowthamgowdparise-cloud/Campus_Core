'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * CourseMaterial – metadata for lecture notes, slides, lab manuals, and study resources.
 */
const CourseMaterialSchema = new Schema(
  {
    title       : { type: String, required: true, trim: true, maxlength: 180 },
    description : { type: String, trim: true },
    course      : { type: Schema.Types.ObjectId, ref: 'Course',       required: true },
    section     : { type: Schema.Types.ObjectId, ref: 'Section',      default: null },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',     required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    faculty     : { type: Schema.Types.ObjectId, ref: 'Faculty',      required: true },
    materialType: {
      type   : String,
      enum   : ['lecture_notes', 'slides', 'lab_manual', 'reference', 'syllabus', 'assignment_sheet', 'other'],
      default: 'lecture_notes',
    },
    fileName       : { type: String, required: true, trim: true },
    fileUrlOrPath  : { type: String, required: true, trim: true },
    storageProvider: { type: String, enum: ['local', 's3', 'external'], default: 'local' },
    storageKey     : { type: String, trim: true, default: null },
    fileHash       : { type: String, trim: true },
    mimeType       : { type: String, trim: true },
    fileSize       : { type: Number, min: 0 },
    uploadedBy     : { type: Schema.Types.ObjectId, ref: 'User' },
    isPublished    : { type: Boolean, default: true },

    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date,    default: null },
    deletedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

CourseMaterialSchema.index({ course: 1, semester: 1, isPublished: 1 });
CourseMaterialSchema.index({ faculty: 1, semester: 1 });
CourseMaterialSchema.index({ isDeleted: 1 });

CourseMaterialSchema.pre(['find', 'findOne', 'findOneAndUpdate', 'countDocuments'], function (next) {
  if (this.getOptions().includeDeleted) return next();
  this.where({ isDeleted: false });
  next();
});

const CourseMaterial = mongoose.model('CourseMaterial', CourseMaterialSchema);
module.exports = CourseMaterial;

