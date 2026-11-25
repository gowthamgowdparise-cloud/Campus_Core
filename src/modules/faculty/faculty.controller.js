'use strict';

const facultyService = require('./faculty.service');
const catchAsync     = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { faculty, meta } = await facultyService.listFaculty(req.query);
  sendSuccess(res, 200, 'Faculty list retrieved successfully', faculty, meta);
});

const getMe = catchAsync(async (req, res) => {
  const profile = await facultyService.getMyFacultyProfile(req.user);
  sendSuccess(res, 200, 'Faculty profile retrieved successfully', profile);
});

const updateMe = catchAsync(async (req, res) => {
  const profile = await facultyService.updateMyProfile(req.user, req.body);
  sendSuccess(res, 200, 'Faculty profile updated successfully', profile);
});

const getMyCourses = catchAsync(async (req, res) => {
  const courses = await facultyService.getAssignedCourses(req.user, req.query);
  sendSuccess(res, 200, 'Assigned courses retrieved successfully', courses);
});

const getMyStudents = catchAsync(async (req, res) => {
  const { enrollments, meta } = await facultyService.getAssignedStudents(req.user, req.query);
  sendSuccess(res, 200, 'Assigned students retrieved successfully', enrollments, meta);
});

const getMyTimetable = catchAsync(async (req, res) => {
  const slots = await facultyService.getMyTimetable(req.user, req.query.semester);
  sendSuccess(res, 200, 'Faculty timetable retrieved successfully', slots);
});

const getById = catchAsync(async (req, res) => {
  const faculty = await facultyService.getFacultyById(req.params.id, req.user);
  sendSuccess(res, 200, 'Faculty retrieved successfully', faculty);
});

const create = catchAsync(async (req, res) => {
  const faculty = await facultyService.createFaculty(req.body);
  sendSuccess(res, 201, 'Faculty created successfully', faculty);
});

const update = catchAsync(async (req, res) => {
  const faculty = await facultyService.updateFaculty(req.params.id, req.body);
  sendSuccess(res, 200, 'Faculty updated successfully', faculty);
});

const remove = catchAsync(async (req, res) => {
  await facultyService.deleteFaculty(req.params.id, req.user.id);
  sendSuccess(res, 200, 'Faculty deleted successfully');
});

module.exports = {
  list,
  getMe,
  updateMe,
  getMyCourses,
  getMyStudents,
  getMyTimetable,
  getById,
  create,
  update,
  remove,
};

