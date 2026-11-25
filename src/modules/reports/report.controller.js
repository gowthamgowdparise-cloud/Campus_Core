'use strict';

const reportService = require('./report.service');
const catchAsync    = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const institutionOverview = catchAsync(async (_req, res) => {
  const data = await reportService.getInstitutionOverview();
  sendSuccess(res, 200, 'Institution overview report generated', data);
});

const attendanceReport = catchAsync(async (req, res) => {
  const data = await reportService.getAttendanceReport(req.query, req.user);
  sendSuccess(res, 200, 'Attendance report generated', data);
});

const academicPerformance = catchAsync(async (req, res) => {
  const data = await reportService.getAcademicPerformanceReport(req.query, req.user);
  sendSuccess(res, 200, 'Academic performance report generated', data);
});

const feeReport = catchAsync(async (req, res) => {
  const data = await reportService.getFeeReport(req.query);
  sendSuccess(res, 200, 'Fee report generated', data);
});

const grievanceReport = catchAsync(async (_req, res) => {
  const data = await reportService.getGrievanceReport();
  sendSuccess(res, 200, 'Grievance analytics report generated', data);
});

module.exports = {
  institutionOverview,
  attendanceReport,
  academicPerformance,
  feeReport,
  grievanceReport,
};

