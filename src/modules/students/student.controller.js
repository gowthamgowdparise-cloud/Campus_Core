'use strict';

const studentService = require('./student.service');
const catchAsync     = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { students, meta } = await studentService.listStudents(req.query, req.user);
  sendSuccess(res, 200, 'Students retrieved successfully', students, meta);
});

const getMe = catchAsync(async (req, res) => {
  const profile = await studentService.getMyProfile(req.user);
  sendSuccess(res, 200, 'Student profile retrieved successfully', profile);
});

const updateMe = catchAsync(async (req, res) => {
  const profile = await studentService.updateMyProfile(req.user, req.body);
  sendSuccess(res, 200, 'Student profile updated successfully', profile);
});

const getMyAcademicHistory = catchAsync(async (req, res) => {
  const history = await studentService.getAcademicHistory(req.user.studentProfile, req.user);
  sendSuccess(res, 200, 'Academic history retrieved successfully', history);
});

const getAcademicHistory = catchAsync(async (req, res) => {
  const history = await studentService.getAcademicHistory(req.params.id, req.user);
  sendSuccess(res, 200, 'Academic history retrieved successfully', history);
});

const getById = catchAsync(async (req, res) => {
  const student = await studentService.getStudentById(req.params.id, req.user);
  sendSuccess(res, 200, 'Student retrieved successfully', student);
});

const create = catchAsync(async (req, res) => {
  const student = await studentService.createStudent(req.body);
  sendSuccess(res, 201, 'Student admitted and registered successfully', student);
});

const update = catchAsync(async (req, res) => {
  const student = await studentService.updateStudent(req.params.id, req.body);
  sendSuccess(res, 200, 'Student updated successfully', student);
});

const remove = catchAsync(async (req, res) => {
  await studentService.deleteStudent(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Student record deleted successfully');
});

module.exports = {
  list,
  getMe,
  updateMe,
  getMyAcademicHistory,
  getAcademicHistory,
  getById,
  create,
  update,
  remove,
};

