'use strict';

const FeeStructure = require('./feeStructure.model');
const FeeRecord    = require('./feeRecord.model');
const Program      = require('../programs/program.model');
const AcademicYear = require('../academic-years/academicYear.model');
const Semester     = require('../semesters/semester.model');
const Student      = require('../students/student.model');
const Notification = require('../notifications/notification.model');
const { getSettingValue }     = require('../system/systemSettings.helper');
const AppError     = require('../../utils/AppError');
const { runInTransaction }    = require('../../utils/transaction');
const { buildPaginationMeta } = require('../../utils/apiResponse');
const { parsePagination }     = require('../../utils/queryHelpers');

const computeComponentsTotal = (components = []) =>
  components.reduce((sum, c) => sum + Number(c.amount || 0), 0);

// ── Fee Structures ─────────────────────────────────────────────────────────
const listStructures = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.academicYear)          filter.academicYear = query.academicYear;
  if (query.year)                  filter.year = Number(query.year);
  if (query.category)              filter.category = query.category;
  if (query.isActive !== undefined) filter.isActive = query.isActive;

  if (caller.role === 'student') {
    const stu = await Student.findById(caller.studentProfile).select('program');
    if (!stu) throw new AppError('Student profile not found', 404);
    filter.program  = stu.program;
    filter.isActive = true;
  } else if (query.program) {
    filter.program = query.program;
  }

  const [structures, total] = await Promise.all([
    FeeStructure.find(filter)
      .populate('program', 'name code shortName')
      .populate('academicYear', 'name isCurrent')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    FeeStructure.countDocuments(filter),
  ]);

  return { structures, meta: buildPaginationMeta({ page, limit, total }) };
};

const getStructureById = async (id, caller) => {
  const fsDoc = await FeeStructure.findById(id)
    .populate('program', 'name code shortName')
    .populate('academicYear', 'name isCurrent');
  if (!fsDoc) throw new AppError('Fee structure not found', 404);

  if (caller.role === 'student') {
    const stu = await Student.findById(caller.studentProfile).select('program');
    if (!stu || String(stu.program) !== String(fsDoc.program._id)) {
      throw new AppError('You do not have permission to view this fee structure.', 403);
    }
  }
  return fsDoc;
};

const createStructure = async (payload, actorId) => {
  const [prog, ay] = await Promise.all([
    Program.findById(payload.program),
    AcademicYear.findById(payload.academicYear),
  ]);
  if (!prog || !prog.isActive) throw new AppError('Valid active program is required', 404);
  if (!ay) throw new AppError('Academic year not found', 404);

  const computedTotal = computeComponentsTotal(payload.components);
  if (payload.totalAmount !== undefined && Math.abs(payload.totalAmount - computedTotal) > 0.01) {
    throw new AppError(`totalAmount (${payload.totalAmount}) must equal sum of fee components (${computedTotal})`, 400);
  }

  return FeeStructure.create({
    ...payload,
    totalAmount: computedTotal,
    createdBy  : actorId,
  });
};

const updateStructure = async (id, payload) => {
  const fsDoc = await FeeStructure.findById(id);
  if (!fsDoc) throw new AppError('Fee structure not found', 404);

  if (payload.components) {
    const computedTotal = computeComponentsTotal(payload.components);
    if (payload.totalAmount !== undefined && Math.abs(payload.totalAmount - computedTotal) > 0.01) {
      throw new AppError(`totalAmount (${payload.totalAmount}) must equal sum of fee components (${computedTotal})`, 400);
    }
    payload.totalAmount = computedTotal;
  }

  Object.assign(fsDoc, payload);
  await fsDoc.save();
  return fsDoc;
};

// ── Fee Records ────────────────────────────────────────────────────────────
const populateFeeRecord = (query) =>
  query
    .populate({
      path    : 'student',
      select  : 'rollNumber enrollmentNumber currentYear currentSemester user',
      populate: { path: 'user', select: 'firstName lastName email' },
    })
    .populate('feeStructure', 'name year category totalAmount components dueDate')
    .populate('academicYear', 'name isCurrent')
    .populate('semester', 'name type')
    .populate('payments', 'receiptNumber amount mode status paidAt reconciliationStatus');

const listRecords = async (query, caller) => {
  const { page, limit, skip } = parsePagination(query);
  const filter = {};
  if (query.academicYear) filter.academicYear = query.academicYear;
  if (query.semester)     filter.semester = query.semester;
  if (query.status)       filter.status = query.status;

  if (caller.role === 'student') {
    if (!caller.studentProfile) throw new AppError('Student profile not linked', 403);
    filter.student = caller.studentProfile;
  } else if (query.student) {
    filter.student = query.student;
  }

  const [records, total] = await Promise.all([
    populateFeeRecord(FeeRecord.find(filter)).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    FeeRecord.countDocuments(filter),
  ]);

  return { records, meta: buildPaginationMeta({ page, limit, total }) };
};

const getMyFees = async (caller) => {
  if (!caller.studentProfile) throw new AppError('Student profile not linked', 404);

  const records = await populateFeeRecord(
    FeeRecord.find({ student: caller.studentProfile })
  ).sort({ createdAt: -1 }).lean();

  const summary = records.reduce(
    (acc, r) => {
      acc.totalDemand     += r.totalDemand || 0;
      acc.totalPaid       += r.totalPaid || 0;
      acc.totalDue        += r.totalDue || 0;
      acc.totalConcession += r.concessionAmount || 0;
      acc.totalLateFine   += r.lateFine || 0;
      return acc;
    },
    { totalDemand: 0, totalPaid: 0, totalDue: 0, totalConcession: 0, totalLateFine: 0 }
  );

  return { summary, records };
};

const getRecordById = async (id, caller) => {
  const rec = await populateFeeRecord(FeeRecord.findById(id));
  if (!rec) throw new AppError('Fee record not found', 404);

  if (caller.role === 'student' && String(rec.student._id) !== String(caller.studentProfile)) {
    throw new AppError('You do not have permission to view another student fee record.', 403);
  }
  return rec;
};

const assignFees = async (payload, actorId) => {
  return runInTransaction(async (session) => {
    const structure = await FeeStructure.findById(payload.feeStructure).session(session);
    if (!structure || !structure.isActive) {
      throw new AppError('Valid active fee structure not found', 404);
    }

    if (payload.semester) {
      const sem = await Semester.findById(payload.semester).session(session);
      if (!sem) throw new AppError('Semester not found', 404);
    }

    const students = await Student.find({ _id: { $in: payload.studentIds } }).session(session);
    if (students.length !== new Set(payload.studentIds).size) {
      throw new AppError('One or more target students were not found', 404);
    }

    // Batch duplicate check eliminates N+1 per-student findOne queries
    const existingRecords = await FeeRecord.find({
      student     : { $in: students.map((s) => s._id) },
      academicYear: structure.academicYear,
      semester    : payload.semester || null,
    }).select('student').session(session).lean();

    const existingStudentSet = new Set(existingRecords.map((r) => String(r.student)));

    const docsToCreate = [];
    for (const stu of students) {
      if (String(stu.program) !== String(structure.program)) {
        throw new AppError(`Student ${stu.rollNumber} belongs to a different program than fee structure ${structure.name}`, 400);
      }
      if (existingStudentSet.has(String(stu._id))) {
        throw new AppError(`Fee record already assigned for student ${stu.rollNumber} in this period`, 409);
      }

      docsToCreate.push({
        student         : stu._id,
        feeStructure    : structure._id,
        academicYear    : structure.academicYear,
        semester        : payload.semester || null,
        totalDemand     : structure.totalAmount,
        dueDate         : payload.dueDate || structure.dueDate,
        concessionAmount: payload.concessionAmount || 0,
        concessionReason: payload.concessionReason,
        isScholarship   : Boolean(payload.isScholarship),
        remarks         : payload.remarks,
        createdBy       : actorId,
      });
    }

    const created = await FeeRecord.create(docsToCreate, { session, ordered: true });

    const notifications = [];
    created.forEach((rec, idx) => {
      const stu = students[idx];
      if (stu?.user) {
        notifications.push({
          recipient : stu.user,
          type      : 'fee_due',
          title     : 'Fee Demand Assigned',
          message   : `Fee of ${rec.totalDemand} (${structure.name}) has been assigned.`,
          entityType: 'FeeRecord',
          entityId  : rec._id,
          channels  : ['in_app'],
        });
      }
    });
    if (notifications.length > 0) {
      await Notification.insertMany(notifications, { session });
    }

    return created;
  });
};

const updateConcession = async (id, payload) => {
  const rec = await FeeRecord.findById(id);
  if (!rec) throw new AppError('Fee record not found', 404);

  if (payload.concessionAmount !== undefined && payload.concessionAmount > rec.totalDemand) {
    throw new AppError('concessionAmount cannot exceed totalDemand', 400);
  }

  Object.assign(rec, payload);
  await rec.save();
  return populateFeeRecord(FeeRecord.findById(rec._id));
};

/**
 * Calculate and apply overdue late fines using FeeStructure.lateFinePerDay or
 * configurable SystemSetting ('fee.lateFinePerDay') inside an atomic transaction.
 */
const applyOverdueLateFines = async ({ academicYear, semester, asOfDate = new Date() } = {}) => {
  const defaultFinePerDay = Number(await getSettingValue('fee.lateFinePerDay', 50)) || 0;
  const cutoff = new Date(asOfDate);

  return runInTransaction(async (session) => {
    const filter = {
      status : { $in: ['pending', 'partial', 'overdue'] },
      dueDate: { $lt: cutoff },
    };
    if (academicYear) filter.academicYear = academicYear;
    if (semester)     filter.semester = semester;

    const overdueRecords = await FeeRecord.find(filter)
      .populate('feeStructure', 'lateFinePerDay')
      .session(session);

    let updatedCount = 0;
    const msPerDay   = 1000 * 60 * 60 * 24;

    for (const rec of overdueRecords) {
      if (rec.totalDue <= 0) continue;
      const daysOverdue = Math.max(1, Math.floor((cutoff - new Date(rec.dueDate)) / msPerDay));
      const structureFine = rec.feeStructure?.lateFinePerDay;
      const ratePerDay = (typeof structureFine === 'number' && structureFine > 0)
        ? structureFine
        : defaultFinePerDay;

      const computedFine = Number((daysOverdue * ratePerDay).toFixed(2));
      if (computedFine !== rec.lateFine || rec.status !== 'overdue') {
        rec.lateFine = Math.max(rec.lateFine || 0, computedFine);
        rec.status   = 'overdue';
        await rec.save({ session });
        updatedCount += 1;
      }
    }

    return {
      evaluatedCount: overdueRecords.length,
      updatedCount,
      defaultFinePerDay,
      asOfDate      : cutoff,
    };
  });
};

module.exports = {
  listStructures,
  getStructureById,
  createStructure,
  updateStructure,
  listRecords,
  getMyFees,
  getRecordById,
  assignFees,
  updateConcession,
  applyOverdueLateFines,
};

