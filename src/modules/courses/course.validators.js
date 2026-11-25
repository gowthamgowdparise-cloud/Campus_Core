'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

module.exports = {
  listQuery: paginationQuerySchema.keys({
    department    : objectIdSchema,
    program       : objectIdSchema,
    semesterNumber: Joi.number().integer().min(1).max(12),
    type          : Joi.string().valid('theory', 'practical', 'theory_practical', 'project', 'seminar', 'internship'),
    category      : Joi.string().valid('core', 'elective', 'open_elective', 'audit', 'mooc', 'extra_curricular'),
    isActive      : Joi.boolean(),
  }),

  create: Joi.object({
    name                 : Joi.string().trim().min(2).max(150).required(),
    code                 : Joi.string().trim().uppercase().min(2).max(20).required(),
    shortName            : Joi.string().trim().max(30).allow('', null),
    department           : objectIdSchema.required(),
    program              : objectIdSchema.required(),
    semesterNumber       : Joi.number().integer().min(1).max(12).required(),
    type                 : Joi.string().valid('theory', 'practical', 'theory_practical', 'project', 'seminar', 'internship').required(),
    category             : Joi.string().valid('core', 'elective', 'open_elective', 'audit', 'mooc', 'extra_curricular').default('core'),
    credits              : Joi.number().min(0).max(10).required(),
    theoryCredits        : Joi.number().min(0).default(0),
    practicalCredits     : Joi.number().min(0).default(0),
    totalMarks           : Joi.number().min(0).default(100),
    passingMarks         : Joi.number().min(0).default(40),
    internalMarks        : Joi.number().min(0).default(30),
    externalMarks        : Joi.number().min(0).default(70),
    lectureHoursPerWeek  : Joi.number().min(0).default(0),
    tutorialHoursPerWeek : Joi.number().min(0).default(0),
    practicalHoursPerWeek: Joi.number().min(0).default(0),
    prerequisites        : Joi.array().items(objectIdSchema).default([]),
    isActive             : Joi.boolean().default(true),
    syllabus             : Joi.string().trim().max(500).allow('', null),
  }),

  update: Joi.object({
    name                 : Joi.string().trim().min(2).max(150),
    shortName            : Joi.string().trim().max(30).allow('', null),
    semesterNumber       : Joi.number().integer().min(1).max(12),
    type                 : Joi.string().valid('theory', 'practical', 'theory_practical', 'project', 'seminar', 'internship'),
    category             : Joi.string().valid('core', 'elective', 'open_elective', 'audit', 'mooc', 'extra_curricular'),
    credits              : Joi.number().min(0).max(10),
    theoryCredits        : Joi.number().min(0),
    practicalCredits     : Joi.number().min(0),
    totalMarks           : Joi.number().min(0),
    passingMarks         : Joi.number().min(0),
    internalMarks        : Joi.number().min(0),
    externalMarks        : Joi.number().min(0),
    lectureHoursPerWeek  : Joi.number().min(0),
    tutorialHoursPerWeek : Joi.number().min(0),
    practicalHoursPerWeek: Joi.number().min(0),
    prerequisites        : Joi.array().items(objectIdSchema),
    isActive             : Joi.boolean(),
    syllabus             : Joi.string().trim().max(500).allow('', null),
  }).min(1),

  listAssignmentsQuery: paginationQuerySchema.keys({
    faculty     : objectIdSchema,
    course      : objectIdSchema,
    section     : objectIdSchema,
    semester    : objectIdSchema,
    academicYear: objectIdSchema,
    isActive    : Joi.boolean(),
  }),

  createAssignment: Joi.object({
    faculty     : objectIdSchema.required(),
    course      : objectIdSchema.required(),
    section     : objectIdSchema.required(),
    semester    : objectIdSchema.required(),
    academicYear: objectIdSchema.required(),
    role        : Joi.string().valid('primary', 'co_instructor', 'lab_instructor').default('primary'),
    remarks     : Joi.string().trim().max(500).allow('', null),
  }),

  assignmentIdParam: Joi.object({
    assignmentId: objectIdSchema.required(),
  }),

  courseIdParam: Joi.object({
    courseId: objectIdSchema.required(),
  }),

  materialIdParam: Joi.object({
    materialId: objectIdSchema.required(),
  }),

  listMaterialsQuery: paginationQuerySchema.keys({
    section     : objectIdSchema,
    semester    : objectIdSchema,
    materialType: Joi.string().valid('lecture_notes', 'slides', 'lab_manual', 'reference', 'syllabus', 'assignment_sheet', 'other'),
  }),

  createMaterial: Joi.object({
    title       : Joi.string().trim().min(2).max(180).required(),
    description : Joi.string().trim().max(1000).allow('', null),
    section     : objectIdSchema.allow(null),
    semester    : objectIdSchema.required(),
    academicYear: objectIdSchema.required(),
    materialType: Joi.string().valid('lecture_notes', 'slides', 'lab_manual', 'reference', 'syllabus', 'assignment_sheet', 'other').default('lecture_notes'),
    isPublished : Joi.boolean().default(true),
  }),

  updateMaterial: Joi.object({
    title       : Joi.string().trim().min(2).max(180),
    description : Joi.string().trim().max(1000).allow('', null),
    materialType: Joi.string().valid('lecture_notes', 'slides', 'lab_manual', 'reference', 'syllabus', 'assignment_sheet', 'other'),
    isPublished : Joi.boolean(),
  }).min(1),
};

