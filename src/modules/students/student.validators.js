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

const addressSchema = Joi.object({
  street : Joi.string().trim().max(200).allow('', null),
  city   : Joi.string().trim().max(80).allow('', null),
  state  : Joi.string().trim().max(80).allow('', null),
  country: Joi.string().trim().max(80).default('India'),
  pincode: Joi.string().trim().max(20).allow('', null),
});

const guardianSchema = Joi.object({
  name        : Joi.string().trim().max(120).allow('', null),
  relationship: Joi.string().valid('father', 'mother', 'guardian', 'other'),
  phone       : Joi.string().trim().max(20).allow('', null),
  email       : Joi.string().email().lowercase().trim().allow('', null),
  occupation  : Joi.string().trim().max(100).allow('', null),
  annualIncome: Joi.number().min(0),
});

const previousQualificationSchema = Joi.object({
  level      : Joi.string().trim().max(60),
  institution: Joi.string().trim().max(180),
  board      : Joi.string().trim().max(120),
  passingYear: Joi.number().integer().min(1950).max(2100),
  percentage : Joi.number().min(0).max(100),
  subjects   : Joi.array().items(Joi.string().trim()),
});

module.exports = {
  listQuery: paginationQuerySchema.keys({
    department     : objectIdSchema,
    program        : objectIdSchema,
    academicYear   : objectIdSchema,
    currentSection : objectIdSchema,
    currentSemester: Joi.number().integer().min(1).max(12),
    batchYear      : Joi.number().integer().min(1950).max(2100),
    status         : Joi.string().valid('active', 'inactive', 'graduated', 'withdrawn', 'transferred', 'detained'),
  }),

  create: Joi.object({
    // User fields
    firstName         : Joi.string().trim().min(1).max(50).required(),
    lastName          : Joi.string().trim().min(1).max(50).required(),
    email             : Joi.string().email().lowercase().trim().required(),
    password          : strongPassword.required(),
    phone             : Joi.string().trim().max(20).allow('', null),
    gender            : Joi.string().valid('male', 'female', 'other', 'prefer_not_to_say'),
    dateOfBirth       : Joi.date().iso(),
    mustChangePassword: Joi.boolean().default(true),

    // Student core fields
    department      : objectIdSchema.required(),
    program         : objectIdSchema.required(),
    academicYear    : objectIdSchema.required(),
    currentSection  : objectIdSchema.allow(null),
    rollNumber      : Joi.string().trim().min(2).max(40).required(),
    enrollmentNumber: Joi.string().trim().max(40).allow('', null),
    admissionNumber : Joi.string().trim().max(40).allow('', null),
    bloodGroup      : Joi.string().valid('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'),
    nationality     : Joi.string().trim().max(60).default('Indian'),
    religion        : Joi.string().trim().max(60).allow('', null),
    caste           : Joi.string().valid('General', 'OBC', 'SC', 'ST', 'EWS', 'Other'),
    motherTongue    : Joi.string().trim().max(60).allow('', null),
    isPhysicallyHandicapped: Joi.boolean().default(false),
    disabilityDetails: Joi.string().trim().max(500).allow('', null),
    admissionDate   : Joi.date().iso().required(),
    admissionType   : Joi.string().valid('regular', 'lateral', 'transfer', 'nri').default('regular'),
    currentSemester : Joi.number().integer().min(1).max(12).default(1),
    currentYear     : Joi.number().integer().min(1).max(6).default(1),
    batchYear       : Joi.number().integer().min(1950).max(2100).required(),
    presentAddress  : addressSchema,
    permanentAddress: addressSchema,
    guardian        : guardianSchema,
    previousQualifications: Joi.array().items(previousQualificationSchema).default([]),
  }),

  adminUpdate: Joi.object({
    firstName      : Joi.string().trim().min(1).max(50),
    lastName       : Joi.string().trim().min(1).max(50),
    phone          : Joi.string().trim().max(20).allow('', null),
    department     : objectIdSchema,
    program        : objectIdSchema,
    currentSection : objectIdSchema.allow(null),
    currentSemester: Joi.number().integer().min(1).max(12),
    currentYear    : Joi.number().integer().min(1).max(6),
    status         : Joi.string().valid('active', 'inactive', 'graduated', 'withdrawn', 'transferred', 'detained'),
    graduationDate : Joi.date().iso().allow(null),
    presentAddress : addressSchema,
    permanentAddress: addressSchema,
    guardian       : guardianSchema,
  }).min(1),

  selfUpdate: Joi.object({
    phone           : Joi.string().trim().max(20).allow('', null),
    profilePicture  : Joi.string().trim().max(500).allow('', null),
    bloodGroup      : Joi.string().valid('A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-', 'Unknown'),
    motherTongue    : Joi.string().trim().max(60).allow('', null),
    presentAddress  : addressSchema,
    permanentAddress: addressSchema,
    guardian        : guardianSchema,
  }).min(1),
};

