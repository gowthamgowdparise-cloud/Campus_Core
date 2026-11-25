'use strict';

require('./setup');

const bcrypt   = require('bcryptjs');
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('../src/config/database');
const { runInTransaction } = require('../src/utils/transaction');

// Import all 25 models to verify compilation, schema rules, and zero duplicate index warnings
const User          = require('../src/modules/users/user.model');
const Student       = require('../src/modules/students/student.model');
const Faculty       = require('../src/modules/faculty/faculty.model');
const Department    = require('../src/modules/departments/department.model');
const Program       = require('../src/modules/programs/program.model');
const AcademicYear  = require('../src/modules/academic-years/academicYear.model');
const Semester      = require('../src/modules/semesters/semester.model');
const Section       = require('../src/modules/sections/section.model');
const Course        = require('../src/modules/courses/course.model');
const Enrollment    = require('../src/modules/enrollments/enrollment.model');
const Attendance    = require('../src/modules/attendance/attendance.model');
const Examination   = require('../src/modules/examinations/examination.model');
const Assessment    = require('../src/modules/assessments/assessment.model');
const Marks         = require('../src/modules/marks/marks.model');
const Result        = require('../src/modules/results/result.model');
const FeeStructure  = require('../src/modules/fees/feeStructure.model');
const FeeRecord     = require('../src/modules/fees/feeRecord.model');
const Payment       = require('../src/modules/payments/payment.model');
const Timetable     = require('../src/modules/timetables/timetable.model');
const Announcement  = require('../src/modules/announcements/announcement.model');
const Notification  = require('../src/modules/notifications/notification.model');
const Document      = require('../src/modules/documents/document.model');
const Grievance     = require('../src/modules/grievances/grievance.model');
const AuditLog      = require('../src/modules/audit-logs/auditLog.model');
const SystemSetting = require('../src/modules/system/systemSetting.model');

const MODELS = [
  ['User',          User],
  ['Student',       Student],
  ['Faculty',       Faculty],
  ['Department',    Department],
  ['Program',       Program],
  ['AcademicYear',  AcademicYear],
  ['Semester',      Semester],
  ['Section',       Section],
  ['Course',        Course],
  ['Enrollment',    Enrollment],
  ['Attendance',    Attendance],
  ['Examination',   Examination],
  ['Assessment',    Assessment],
  ['Marks',         Marks],
  ['Result',        Result],
  ['FeeStructure',  FeeStructure],
  ['FeeRecord',     FeeRecord],
  ['Payment',       Payment],
  ['Timetable',     Timetable],
  ['Announcement',  Announcement],
  ['Notification',  Notification],
  ['Document',      Document],
  ['Grievance',     Grievance],
  ['AuditLog',      AuditLog],
  ['SystemSetting', SystemSetting],
];

describe('Mongoose Models (Schema & Unit Checks)', () => {
  test.each(MODELS)('%s model is registered without duplicate index definitions', (name, Model) => {
    expect(Model).toBeDefined();
    expect(Model.modelName).toBe(name);
    expect(typeof Model.find).toBe('function');
    expect(typeof Model.create).toBe('function');

    // Verify no identical index key signature is declared twice on the schema
    const indexKeySignatures = Model.schema.indexes().map(([keys]) => JSON.stringify(keys));
    expect(new Set(indexKeySignatures).size).toBe(indexKeySignatures.length);
  });

  test('User virtual fullName and toJSON sanitization work', () => {
    const user = new User({
      firstName   : 'John',
      lastName    : 'Doe',
      email       : 'john@test.com',
      role        : 'admin',
      passwordHash: 'Secret@123!',
    });
    expect(user.fullName).toBe('John Doe');
    const json = user.toJSON();
    expect(json).not.toHaveProperty('passwordHash');
    expect(json).not.toHaveProperty('refreshTokens');
  });

  test('User.verifyPassword returns true for matching password', async () => {
    const user = new User({
      firstName   : 'T',
      lastName    : 'E',
      email       : 'x@t.com',
      role        : 'admin',
      passwordHash: 'Test@1234!',
    });
    user.passwordHash = await bcrypt.hash('Test@1234!', 4);
    expect(await user.verifyPassword('Test@1234!')).toBe(true);
    expect(await user.verifyPassword('Wrong!')).toBe(false);
  });

  test('User.isTokenIssuedBefore handles initial creation and password changes accurately', () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const user = new User({
      firstName   : 'A',
      lastName    : 'B',
      email       : 'ab@t.com',
      role        : 'student',
      passwordHash: 'hash',
    });

    // No passwordChangedAt on initial creation -> valid
    expect(user.isTokenIssuedBefore(nowSec)).toBe(false);

    // Password changed after token issuance -> invalid
    user.passwordChangedAt = new Date((nowSec + 5) * 1000);
    expect(user.isTokenIssuedBefore(nowSec)).toBe(true);

    // Token issued at or after passwordChangedAt -> valid
    expect(user.isTokenIssuedBefore(nowSec + 5)).toBe(false);
  });

  test('User refresh token storage hashes tokens and preserves active devices', () => {
    const user = new User({
      firstName   : 'R',
      lastName    : 'T',
      email       : 'rt@t.com',
      role        : 'faculty',
      passwordHash: 'hash',
    });

    const future = new Date(Date.now() + 60_000);
    user.addRefreshToken({ token: 'raw-secret-token', family: 'fam1', expiresAt: future });

    // Raw token must not be stored in plaintext
    expect(user.refreshTokens[0].token).not.toBe('raw-secret-token');
    expect(user.findRefreshToken('raw-secret-token')).toBeTruthy();
    expect(user.revokeRefreshToken('raw-secret-token')).toBe(true);
    expect(user.findRefreshToken('raw-secret-token')).toBeUndefined();
  });

  test('Marks compound unique index includes assessment and examination', () => {
    const indexes = Marks.schema.indexes();
    const uniqueIdx = indexes.find(([, opts]) => opts.unique);
    expect(uniqueIdx).toBeDefined();
    expect(Object.keys(uniqueIdx[0])).toEqual(
      expect.arrayContaining(['student', 'course', 'semester', 'marksType', 'assessment', 'examination'])
    );
  });

  test('Marks rejects obtainedMarks > maxMarks when not absent', () => {
    const mark = new Marks({
      student      : new mongoose.Types.ObjectId(),
      enrollment   : new mongoose.Types.ObjectId(),
      course       : new mongoose.Types.ObjectId(),
      semester     : new mongoose.Types.ObjectId(),
      academicYear : new mongoose.Types.ObjectId(),
      marksType    : 'internal',
      maxMarks     : 30,
      obtainedMarks: 35,
      enteredBy    : new mongoose.Types.ObjectId(),
    });
    const err = mark.validateSync();
    expect(err.errors.obtainedMarks).toBeDefined();
  });

  test('Attendance defaults periodNumber to 1 and includes sessionType in unique index', () => {
    const att = new Attendance({
      course      : new mongoose.Types.ObjectId(),
      section     : new mongoose.Types.ObjectId(),
      semester    : new mongoose.Types.ObjectId(),
      academicYear: new mongoose.Types.ObjectId(),
      faculty     : new mongoose.Types.ObjectId(),
      date        : new Date(),
    });
    expect(att.periodNumber).toBe(1);
    const uniqueIdx = Attendance.schema.indexes().find(([, opts]) => opts.unique);
    expect(Object.keys(uniqueIdx[0])).toEqual(
      expect.arrayContaining(['course', 'section', 'date', 'periodNumber', 'sessionType'])
    );
  });

  test('Grievance auto-generates unique ticketNumber synchronously on validate', () => {
    const g1 = new Grievance({
      raisedBy   : new mongoose.Types.ObjectId(),
      category   : 'academic',
      subject    : 'Lab issue',
      description: 'Equipment missing',
    });
    const g2 = new Grievance({
      raisedBy   : new mongoose.Types.ObjectId(),
      category   : 'academic',
      subject    : 'Lab issue 2',
      description: 'Equipment missing 2',
    });

    expect(g1.validateSync()).toBeUndefined();
    expect(g2.validateSync()).toBeUndefined();
    expect(g1.ticketNumber).toMatch(/^GRV-\d{8}-[A-F0-9]{8}$/);
    expect(g1.ticketNumber).not.toBe(g2.ticketNumber);
  });

  test('AcademicYear validates endDate > startDate', () => {
    const ay = new AcademicYear({
      name     : '2025-26',
      startDate: new Date('2025-07-01'),
      endDate  : new Date('2025-06-01'),
    });
    const err = ay.validateSync();
    expect(err.errors.endDate).toBeDefined();
  });
});

describe('Mongoose Models (MongoDB Atlas Integration)', () => {
  const testEmail = `model.test.${Date.now()}@campuscore.edu`;

  beforeAll(async () => {
    await connectDB();
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: testEmail }).setOptions({ includeDeleted: true });
      await disconnectDB();
    }
  }, 15000);

  test('User model has email index in MongoDB', async () => {
    await User.syncIndexes();
    const indexes = await User.collection.indexes();
    const indexKeys = indexes.map((i) => Object.keys(i.key).join(','));
    expect(indexKeys).toContain('email');
  });

  test('User pre-save hashes password in MongoDB', async () => {
    const created = await User.create({
      firstName   : 'Model',
      lastName    : 'Tester',
      email       : testEmail,
      role        : 'student',
      passwordHash: 'Strong@123!',
    });

    const fetched = await User.findById(created._id).select('+passwordHash');
    expect(fetched.passwordHash).not.toBe('Strong@123!');
    expect(await fetched.verifyPassword('Strong@123!')).toBe(true);
  });

  test('runInTransaction commits and rolls back cleanly on Atlas replica set', async () => {
    const rollbackEmail = `tx.rollback.${Date.now()}@campuscore.edu`;
    await expect(
      runInTransaction(async (session) => {
        await User.create(
          [
            {
              firstName   : 'Tx',
              lastName    : 'Rollback',
              email       : rollbackEmail,
              role        : 'student',
              passwordHash: 'TxPass@123!',
            },
          ],
          { session }
        );
        throw new Error('Force transaction abort');
      })
    ).rejects.toThrow('Force transaction abort');

    const shouldNotExist = await User.findOne({ email: rollbackEmail });
    expect(shouldNotExist).toBeNull();
  });
});
