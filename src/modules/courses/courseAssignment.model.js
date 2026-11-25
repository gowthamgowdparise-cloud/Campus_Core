'use strict';

const mongoose = require('mongoose');
const { Schema } = mongoose;

/**
 * CourseAssignment – links a Faculty member to teach a Course for a Section in a Semester.
 * Forms the authoritative source for faculty-level authorization.
 */
const CourseAssignmentSchema = new Schema(
  {
    faculty     : { type: Schema.Types.ObjectId, ref: 'Faculty',      required: true },
    course      : { type: Schema.Types.ObjectId, ref: 'Course',       required: true },
    section     : { type: Schema.Types.ObjectId, ref: 'Section',      required: true },
    semester    : { type: Schema.Types.ObjectId, ref: 'Semester',     required: true },
    academicYear: { type: Schema.Types.ObjectId, ref: 'AcademicYear', required: true },
    role        : {
      type   : String,
      enum   : ['primary', 'co_instructor', 'lab_instructor'],
      default: 'primary',
    },
    isActive  : { type: Boolean, default: true },
    assignedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    remarks   : { type: String, trim: true },
  },
  { timestamps: true }
);

CourseAssignmentSchema.index({ course: 1, section: 1, semester: 1, faculty: 1 }, { unique: true });
CourseAssignmentSchema.index({ faculty: 1, semester: 1, isActive: 1 });
CourseAssignmentSchema.index({ section: 1, semester: 1 });

const CourseAssignment = mongoose.model('CourseAssignment', CourseAssignmentSchema);
module.exports = CourseAssignment;

