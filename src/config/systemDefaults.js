'use strict';

/**
 * Default institutional configuration values used as fallbacks when a key
 * has not yet been customized in the SystemSetting collection.
 */
const DEFAULT_GRADING_SCALE = Object.freeze([
  { grade: 'O',  minPercentage: 90, maxPercentage: 100,   gradePoint: 10, isPass: true },
  { grade: 'A+', minPercentage: 80, maxPercentage: 89.99, gradePoint: 9,  isPass: true },
  { grade: 'A',  minPercentage: 70, maxPercentage: 79.99, gradePoint: 8,  isPass: true },
  { grade: 'B+', minPercentage: 60, maxPercentage: 69.99, gradePoint: 7,  isPass: true },
  { grade: 'B',  minPercentage: 50, maxPercentage: 59.99, gradePoint: 6,  isPass: true },
  { grade: 'C',  minPercentage: 40, maxPercentage: 49.99, gradePoint: 5,  isPass: true },
  { grade: 'F',  minPercentage: 0,  maxPercentage: 39.99, gradePoint: 0,  isPass: false },
]);

const SYSTEM_DEFAULTS = Object.freeze({
  'attendance.minimumPercentage': {
    value      : 75,
    dataType   : 'number',
    group      : 'attendance',
    label      : 'Minimum Attendance Percentage',
    description: 'Minimum required attendance percentage for exam eligibility',
    isPublic   : true,
  },
  'attendance.lateCountsAsPresent': {
    value      : true,
    dataType   : 'boolean',
    group      : 'attendance',
    label      : 'Late Counts As Present',
    description: 'Whether late attendance status counts toward attended classes',
    isPublic   : true,
  },
  'attendance.editWindowHours': {
    value      : 48,
    dataType   : 'number',
    group      : 'attendance',
    label      : 'Attendance Edit Window (Hours)',
    description: 'Hours after session date during which faculty may update an unfinalized session',
    isPublic   : false,
  },
  'grading.passingPercentage': {
    value      : 40,
    dataType   : 'number',
    group      : 'grading',
    label      : 'Default Passing Percentage',
    description: 'Minimum percentage required to pass a course unless overridden by course rules',
    isPublic   : true,
  },
  'grading.maxGraceMarks': {
    value      : 5,
    dataType   : 'number',
    group      : 'grading',
    label      : 'Maximum Grace Marks',
    description: 'Maximum institutional grace marks permitted per course',
    isPublic   : false,
  },
  'grading.scale': {
    value      : DEFAULT_GRADING_SCALE,
    dataType   : 'array',
    group      : 'grading',
    label      : 'Institutional Grading Scale',
    description: 'Configurable grade boundaries and grade points for SGPA/CGPA computation',
    isPublic   : true,
  },
  'enrollment.defaultMaxCredits': {
    value      : 30,
    dataType   : 'number',
    group      : 'enrollment',
    label      : 'Default Max Semester Credits',
    description: 'Default upper credit limit when Program semesterConfig does not override it',
    isPublic   : true,
  },
  'enrollment.defaultMinCredits': {
    value      : 12,
    dataType   : 'number',
    group      : 'enrollment',
    label      : 'Default Min Semester Credits',
    description: 'Default minimum semester credits',
    isPublic   : true,
  },
  'fee.lateFinePerDay': {
    value      : 50,
    dataType   : 'number',
    group      : 'fee',
    label      : 'Default Late Fine Per Day',
    description: 'Default daily late fine when not specified in FeeStructure',
    isPublic   : true,
  },
});

module.exports = { DEFAULT_GRADING_SCALE, SYSTEM_DEFAULTS };

