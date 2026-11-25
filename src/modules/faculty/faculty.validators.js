'use strict';

const Joi = require('joi');
const { objectIdSchema, paginationQuerySchema } = require('../../validators/common.validator');

const strongPassword = Joi.string()
  .min(8)
  .max(72)
  .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_])/)
  .messages({
    'string.pattern.base': 'Password must contain uppercase, lowercase, digit, and special character',
  });

const qualificationItem = Joi.object({
  degree     : Joi.string().trim().required(),
  field      : Joi.string().trim().allow('', null),
  institution: Joi.string().trim().allow('', null),
  passingYear: Joi.number().integer().min(1950).max(2100),
  grade      : Joi.string().trim().allow('', null),
});

const experienceItem = Joi.object({
  organization    : Joi.string().trim().allow('', null),
  designation     : Joi.string().trim().allow('', null),
  from            : Joi.date().iso(),
  to              : Joi.date().iso().allow(null),
  responsibilities: Joi.string().trim().allow('', null),
});

module.exports = {
  listQuery: paginationQuerySchema.keys({
    department    : objectIdSchema,
    designation   : Joi.string().valid('professor', 'associate_professor', 'assistant_professor', 'lecturer', 'visiting_faculty', 'adjunct_faculty'),
    employmentType: Joi.string().valid('permanent', 'contract', 'visiting', 'temporary'),
    status        : Joi.string().valid('active', 'on_leave', 'resigned', 'terminated'),
  }),

  create: Joi.object({
    // User account fields
    firstName         : Joi.string().trim().min(1).max(50).required(),
    lastName          : Joi.string().trim().min(1).max(50).required(),
    email             : Joi.string().email().lowercase().trim().required(),
    password          : strongPassword.required(),
    phone             : Joi.string().trim().max(20).allow('', null),
    gender            : Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
    dateOfBirth       : Joi.date().iso(),
    mustChangePassword: Joi.boolean().default(true),

    // Faculty fields
    department          : objectIdSchema.required(),
    employeeId          : Joi.string().trim().min(2).max(40).required(),
    facultyCode         : Joi.string().trim().max(40).allow('', null),
    designation         : Joi.string().valid('professor', 'associate_professor', 'assistant_professor', 'lecturer', 'visiting_faculty', 'adjunct_faculty').required(),
    specialization      : Joi.array().items(Joi.string().trim()).default([]),
    qualifications      : Joi.array().items(qualificationItem).default([]),
    experience          : Joi.array().items(experienceItem).default([]),
    totalExperienceYears: Joi.number().min(0).default(0),
    employmentType      : Joi.string().valid('permanent', 'contract', 'visiting', 'temporary').default('permanent'),
    joiningDate         : Joi.date().iso().required(),
    researchInterests   : Joi.array().items(Joi.string().trim()).default([]),
    publications        : Joi.number().integer().min(0).default(0),
  }),

  adminUpdate: Joi.object({
    firstName           : Joi.string().trim().min(1).max(50),
    lastName            : Joi.string().trim().min(1).max(50),
    phone               : Joi.string().trim().max(20).allow('', null),
    department          : objectIdSchema,
    designation         : Joi.string().valid('professor', 'associate_professor', 'assistant_professor', 'lecturer', 'visiting_faculty', 'adjunct_faculty'),
    specialization      : Joi.array().items(Joi.string().trim()),
    qualifications      : Joi.array().items(qualificationItem),
    experience          : Joi.array().items(experienceItem),
    totalExperienceYears: Joi.number().min(0),
    employmentType      : Joi.string().valid('permanent', 'contract', 'visiting', 'temporary'),
    relievingDate       : Joi.date().iso().allow(null),
    researchInterests   : Joi.array().items(Joi.string().trim()),
    publications        : Joi.number().integer().min(0),
    status              : Joi.string().valid('active', 'on_leave', 'resigned', 'terminated'),
  }).min(1),

  selfUpdate: Joi.object({
    phone            : Joi.string().trim().max(20).allow('', null),
    profilePicture   : Joi.string().trim().max(500).allow('', null),
    specialization   : Joi.array().items(Joi.string().trim()),
    qualifications   : Joi.array().items(qualificationItem),
    researchInterests: Joi.array().items(Joi.string().trim()),
    publications     : Joi.number().integer().min(0),
  }).min(1),

  meStudentsQuery: paginationQuerySchema.keys({
    course  : objectIdSchema,
    section : objectIdSchema,
    semester: objectIdSchema,
  }),
};

