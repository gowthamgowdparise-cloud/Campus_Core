'use strict';

const attendanceService = require('./attendance.service');
const catchAsync        = require('../../utils/catchAsync');
const { sendSuccess }   = require('../../utils/apiResponse');

const getPolicy = catchAsync(async (_req, res) => {
  const policy = await attendanceService.getPolicy();
  sendSuccess(res, 200, 'Attendance policy retrieved successfully', policy);
});

const updatePolicy = catchAsync(async (req, res) => {
  const policy = await attendanceService.updatePolicy(req.body, req.user.id);
  sendSuccess(res, 200, 'Attendance policy updated successfully', policy);
});

const createSession = catchAsync(async (req, res) => {
  const session = await attendanceService.createSession(req.body, req.user);
  sendSuccess(res, 201, 'Attendance session recorded successfully', session);
});

const listSessions = catchAsync(async (req, res) => {
  const { sessions, meta } = await attendanceService.listSessions(req.query, req.user);
  sendSuccess(res, 200, 'Attendance sessions retrieved successfully', sessions, meta);
});

const getSession = catchAsync(async (req, res) => {
  const session = await attendanceService.getSessionById(req.params.id, req.user);
  sendSuccess(res, 200, 'Attendance session retrieved successfully', session);
});

const updateSession = catchAsync(async (req, res) => {
  const session = await attendanceService.updateSession(req.params.id, req.body, req.user);
  sendSuccess(res, 200, 'Attendance session updated successfully', session);
});

const finalizeSession = catchAsync(async (req, res) => {
  const session = await attendanceService.finalizeSession(req.params.id, req.user);
  sendSuccess(res, 200, 'Attendance session finalized successfully', session);
});

const getMyAttendance = catchAsync(async (req, res) => {
  const summary = await attendanceService.getStudentSummary(req.user.studentProfile, req.query, req.user);
  sendSuccess(res, 200, 'My attendance summary retrieved successfully', summary);
});

const getStudentSummary = catchAsync(async (req, res) => {
  const summary = await attendanceService.getStudentSummary(req.params.studentId, req.query, req.user);
  sendSuccess(res, 200, 'Student attendance summary retrieved successfully', summary);
});

const getReport = catchAsync(async (req, res) => {
  const report = await attendanceService.getClassAttendanceReport(req.query, req.user);
  sendSuccess(res, 200, 'Attendance report generated successfully', report);
});

const createCorrection = catchAsync(async (req, res) => {
  const request = await attendanceService.createCorrectionRequest(req.body, req.user);
  sendSuccess(res, 201, 'Attendance correction request submitted successfully', request);
});

const listCorrections = catchAsync(async (req, res) => {
  const { requests, meta } = await attendanceService.listCorrectionRequests(req.query, req.user);
  sendSuccess(res, 200, 'Attendance correction requests retrieved successfully', requests, meta);
});

const reviewCorrection = catchAsync(async (req, res) => {
  const reviewed = await attendanceService.reviewCorrectionRequest(req.params.id, req.body, req.user);
  sendSuccess(res, 200, `Attendance correction request ${req.body.decision}`, reviewed);
});

module.exports = {
  getPolicy,
  updatePolicy,
  createSession,
  listSessions,
  getSession,
  updateSession,
  finalizeSession,
  getMyAttendance,
  getStudentSummary,
  getReport,
  createCorrection,
  listCorrections,
  reviewCorrection,
};

