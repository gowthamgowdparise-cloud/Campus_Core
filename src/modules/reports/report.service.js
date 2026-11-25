'use strict';

const Student     = require('../students/student.model');
const Faculty     = require('../faculty/faculty.model');
const Department  = require('../departments/department.model');
const Program     = require('../programs/program.model');
const Course      = require('../courses/course.model');
const Examination = require('../examinations/examination.model');
const FeeRecord   = require('../fees/feeRecord.model');
const Payment     = require('../payments/payment.model');
const Grievance   = require('../grievances/grievance.model');
const attendanceService = require('../attendance/attendance.service');
const resultService     = require('../results/result.service');

const getInstitutionOverview = async () => {
  const [
    totalStudents,
    activeStudents,
    totalFaculty,
    activeFaculty,
    departments,
    programs,
    courses,
    examinations,
    openGrievances,
    feeTotals,
  ] = await Promise.all([
    Student.countDocuments(),
    Student.countDocuments({ status: 'active' }),
    Faculty.countDocuments(),
    Faculty.countDocuments({ status: 'active' }),
    Department.countDocuments({ isActive: true }),
    Program.countDocuments({ isActive: true }),
    Course.countDocuments({ isActive: true }),
    Examination.countDocuments(),
    Grievance.countDocuments({ status: { $in: ['open', 'in_progress', 'awaiting_response'] } }),
    FeeRecord.aggregate([
      {
        $group: {
          _id        : null,
          totalDemand: { $sum: '$totalDemand' },
          totalPaid  : { $sum: '$totalPaid' },
          totalDue   : { $sum: '$totalDue' },
        },
      },
    ]),
  ]);

  return {
    students    : { total: totalStudents, active: activeStudents },
    faculty     : { total: totalFaculty, active: activeFaculty },
    academics   : { departments, programs, courses, examinations },
    grievances  : { open: openGrievances },
    finance     : feeTotals[0]
      ? { totalDemand: feeTotals[0].totalDemand, totalPaid: feeTotals[0].totalPaid, totalDue: feeTotals[0].totalDue }
      : { totalDemand: 0, totalPaid: 0, totalDue: 0 },
  };
};

const getAttendanceReport = (query, caller) =>
  attendanceService.getClassAttendanceReport(query, caller);

const getAcademicPerformanceReport = (query, caller) =>
  resultService.getClassPerformanceReport(query, caller);

const getFeeReport = async (query) => {
  const match = {};
  if (query.academicYear) match.academicYear = new (require('mongoose').Types.ObjectId)(query.academicYear);
  if (query.semester)     match.semester = new (require('mongoose').Types.ObjectId)(query.semester);

  const [byStatus, totals, paymentsByMode] = await Promise.all([
    FeeRecord.aggregate([
      { $match: match },
      { $group: { _id: '$status', count: { $sum: 1 }, totalDemand: { $sum: '$totalDemand' }, totalPaid: { $sum: '$totalPaid' }, totalDue: { $sum: '$totalDue' } } },
    ]),
    FeeRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id             : null,
          totalRecords    : { $sum: 1 },
          totalDemand     : { $sum: '$totalDemand' },
          totalPaid       : { $sum: '$totalPaid' },
          totalDue        : { $sum: '$totalDue' },
          totalConcessions: { $sum: '$concessionAmount' },
          totalLateFines  : { $sum: '$lateFine' },
        },
      },
    ]),
    Payment.aggregate([
      { $match: { status: 'success' } },
      { $group: { _id: '$mode', count: { $sum: 1 }, totalAmount: { $sum: '$amount' } } },
    ]),
  ]);

  return {
    summary: totals[0] || {
      totalRecords    : 0,
      totalDemand     : 0,
      totalPaid       : 0,
      totalDue        : 0,
      totalConcessions: 0,
      totalLateFines  : 0,
    },
    byStatus,
    paymentsByMode,
  };
};

const getGrievanceReport = async () => {
  const [byStatus, byCategory, byPriority] = await Promise.all([
    Grievance.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Grievance.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }]),
    Grievance.aggregate([{ $group: { _id: '$priority', count: { $sum: 1 } } }]),
  ]);
  return { byStatus, byCategory, byPriority };
};

module.exports = {
  getInstitutionOverview,
  getAttendanceReport,
  getAcademicPerformanceReport,
  getFeeReport,
  getGrievanceReport,
};

