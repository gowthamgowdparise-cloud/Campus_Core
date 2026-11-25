'use strict';

require('./setup');

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const logger   = require('../src/utils/logger');
const { errorHandler }   = require('../src/middleware/errorHandler');
const { runInTransaction } = require('../src/utils/transaction');
const { connectDB, disconnectDB } = require('../src/config/database');

const User         = require('../src/modules/users/user.model');
const Department   = require('../src/modules/departments/department.model');
const Program      = require('../src/modules/programs/program.model');
const AcademicYear = require('../src/modules/academic-years/academicYear.model');
const Semester     = require('../src/modules/semesters/semester.model');
const Section      = require('../src/modules/sections/section.model');
const Student      = require('../src/modules/students/student.model');
const Course       = require('../src/modules/courses/course.model');
const Enrollment   = require('../src/modules/enrollments/enrollment.model');
const Marks        = require('../src/modules/marks/marks.model');
const Result       = require('../src/modules/results/result.model');
const FeeStructure = require('../src/modules/fees/feeStructure.model');
const FeeRecord    = require('../src/modules/fees/feeRecord.model');
const Notification = require('../src/modules/notifications/notification.model');
const SystemSetting = require('../src/modules/system/systemSetting.model');
const AuditLog     = require('../src/modules/audit-logs/auditLog.model');

const RUN = `SEC${Date.now()}`;
const PASSWORD = 'SecTest@2026!';

jest.setTimeout(30000);

describe('Security Hardening, Reliability, Audit Immutability & DB Transactions', () => {
  const createdUserIds = [];
  let adminToken;
  let deptId;
  let programId;
  let ayId;
  let semId;
  let secId;
  let courseId;
  let stuId;
  let feeStructureId;
  let feeRecordId;
  let originalEnv;
  let originalOrigins;

  beforeAll(async () => {
    originalEnv     = process.env.NODE_ENV;
    originalOrigins = process.env.ALLOWED_ORIGINS;
    await connectDB();

    const adminUser = await User.create({
      firstName   : 'Sec',
      lastName    : 'Admin',
      email       : `sec.admin.${RUN.toLowerCase()}@campuscore.edu`,
      role        : 'admin',
      passwordHash: PASSWORD,
      status      : 'active',
    });
    createdUserIds.push(adminUser._id);

    const login = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminUser.email, password: PASSWORD });
    adminToken = login.body.data.accessToken;
  }, 20000);

  afterEach(() => {
    process.env.NODE_ENV        = originalEnv;
    process.env.ALLOWED_ORIGINS = originalOrigins;
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        AuditLog.deleteMany({ actor: { $in: createdUserIds } }).setOptions({ allowCleanupInTest: true }),
        Notification.deleteMany({ recipient: { $in: createdUserIds } }),
        FeeRecord.deleteMany({ _id: feeRecordId }),
        FeeStructure.deleteMany({ _id: feeStructureId }),
        Result.deleteMany({ student: stuId }),
        Marks.deleteMany({ student: stuId }),
        Enrollment.deleteMany({ student: stuId }),
        Course.deleteMany({ _id: courseId }).setOptions({ includeDeleted: true }),
        Student.deleteMany({ _id: stuId }).setOptions({ includeDeleted: true }),
        Section.deleteMany({ _id: secId }),
        Semester.deleteMany({ _id: semId }),
        AcademicYear.deleteMany({ _id: ayId }),
        Program.deleteMany({ _id: programId }).setOptions({ includeDeleted: true }),
        Department.deleteMany({ code: { $in: [`SEC${RUN.slice(-5)}`, `RB${RUN.slice(-5)}`] } }).setOptions({ includeDeleted: true }),
        SystemSetting.deleteMany({ key: 'fee.lateFinePerDay' }),
        User.deleteMany({ _id: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
      ]);
      await disconnectDB();
    }
  }, 25000);

  test('Request Correlation IDs, Security Headers, Production Error Sanitization & Log Redaction', async () => {
    const res = await request(app)
      .get('/health/live')
      .set('X-Request-Id', 'trace-corr-id-12345');

    expect(res.statusCode).toBe(200);
    expect(res.headers['x-request-id']).toBe('trace-corr-id-12345');
    expect(res.headers['x-powered-by']).toBeUndefined();
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    // Invalid X-Request-Id replaced with fresh UUID
    const replaced = await request(app)
      .get('/health/live')
      .set('X-Request-Id', 'bad;header!');
    expect(replaced.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/i);

    // OpenAPI / Swagger endpoints available and valid
    const specRes = await request(app).get('/api/v1/docs.json');
    expect(specRes.statusCode).toBe(200);
    expect(specRes.body.openapi).toBe('3.0.3');
    expect(specRes.body.paths).toHaveProperty('/api/v1/auth/login');
    expect(specRes.body.paths).toHaveProperty('/api/v1/payments/webhooks/{provider}');

    const uiRes = await request(app).get('/api/v1/docs/');
    expect(uiRes.statusCode).toBe(200);

    // Production CORS fail-closed when ALLOWED_ORIGINS is empty
    process.env.NODE_ENV        = 'production';
    process.env.ALLOWED_ORIGINS = '';
    const blockedOrigin = await request(app)
      .get('/health/live')
      .set('Origin', 'https://untrusted.example.com');
    expect(blockedOrigin.statusCode).toBe(403);

    process.env.ALLOWED_ORIGINS = 'https://erp.example.edu';
    const allowedOrigin = await request(app)
      .get('/health/live')
      .set('Origin', 'https://erp.example.edu');
    expect(allowedOrigin.statusCode).toBe(200);
    expect(allowedOrigin.headers['access-control-allow-origin']).toBe('https://erp.example.edu');

    // Production readiness health endpoint omits internal database.name & env
    const prodReady = await request(app).get('/health/ready');
    expect(prodReady.statusCode).toBe(200);
    expect(prodReady.body.database).not.toHaveProperty('name');
    expect(prodReady.body).not.toHaveProperty('env');

    // Unhandled 500 error in production does NOT leak internal details or stack
    const mockRes = { status: jest.fn().mockReturnThis(), json: jest.fn().mockReturnThis() };
    errorHandler(
      new Error('MongoServerSelectionError internal host cluster0-shard-01'),
      { id: 'req-123', path: '/test', method: 'GET' },
      mockRes,
      jest.fn()
    );
    expect(mockRes.status).toHaveBeenCalledWith(500);
    const errorPayload = mockRes.json.mock.calls[0][0];
    expect(errorPayload.message).toBe('Internal Server Error');
    expect(errorPayload).not.toHaveProperty('stack');

    // Logger secret & URI password redaction
    const redacted = logger.redactValue({
      password  : 'SecretPass1!',
      keySecret : 'rzp_secret_123',
      uri       : 'mongodb+srv://dbuser:SuperSecretPass@cluster0.mongodb.net/campuscore',
      authHeader: 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig',
    });
    expect(redacted.password).toBe('[REDACTED]');
    expect(redacted.keySecret).toBe('[REDACTED]');
    expect(redacted.uri).not.toContain('SuperSecretPass');
    expect(redacted.uri).toContain('[REDACTED]');
    expect(redacted.authHeader).toBe('Bearer [REDACTED]');

    // Verify Winston colorize + redactSecrets preserves Symbol(level) without crashing
    const formatted = logger.transports[0].format.transform({
      level  : 'info',
      message: 'Connected mongodb+srv://user:TopSecret99@cluster.mongodb.net/campuscore',
      [Symbol.for('level')]: 'info',
    });
    expect(formatted).toBeTruthy();
    expect(formatted[Symbol.for('level')]).toBe('info');
    expect(formatted.message).not.toContain('TopSecret99');
  });

  test('AuditLog immutability prevents updates and non-test deletions', async () => {
    const log = await AuditLog.create({
      actorRole: 'system',
      action   : 'IMMUTABILITY_CHECK',
      module   : 'system',
      method   : 'POST',
      endpoint : '/internal/check',
      status   : 'success',
    });

    await expect(
      AuditLog.updateOne({ _id: log._id }, { $set: { action: 'TAMPERED' } })
    ).rejects.toThrow('immutable');

    await expect(
      AuditLog.deleteOne({ _id: log._id })
    ).rejects.toThrow('immutable');

    // Explicit test cleanup still works cleanly when allowCleanupInTest: true
    await AuditLog.deleteOne({ _id: log._id }).setOptions({ allowCleanupInTest: true });
  });

  test('Real MongoDB Atlas Transaction Rollback, Historical Preservation on Graduation & Late Fines', async () => {
    const rollbackCode = `RB${RUN.slice(-5)}`;
    await expect(
      runInTransaction(async (session) => {
        await Department.create([{ name: `Rollback Dept ${RUN}`, code: rollbackCode }], { session });
        throw new Error('Simulated failure after insert');
      })
    ).rejects.toThrow('Simulated failure after insert');

    const rolledBack = await Department.findOne({ code: rollbackCode }).setOptions({ includeDeleted: true });
    expect(rolledBack).toBeNull();

    // Create Department -> Program -> AY -> Sem -> Section -> Student -> Course -> Enrollment -> Fee -> Marks -> Result
    const dept = await Department.create({ name: `Hist Dept ${RUN}`, code: `SEC${RUN.slice(-5)}` });
    deptId = dept._id;
    const prog = await Program.create({
      name: `BTech ${RUN}`, code: `P${RUN.slice(-5)}`, department: deptId, type: 'undergraduate', duration: 4, totalSemesters: 8,
    });
    programId = prog._id;
    const ay = await AcademicYear.create({
      name: `AY-${RUN}`, startDate: '2025-07-01', endDate: '2026-06-30', status: 'active',
    });
    ayId = ay._id;
    const sem = await Semester.create({
      name: `Sem 1 ${RUN}`, academicYear: ayId, type: 'odd', semesterNumber: 1,
      startDate: '2025-07-10', endDate: '2025-12-15', status: 'ongoing',
    });
    semId = sem._id;
    const sec = await Section.create({
      name: 'A', program: programId, department: deptId, academicYear: ayId, semester: semId, year: 1, semesterNumber: 1,
    });
    secId = sec._id;

    const stuRes = await request(app).post('/api/v1/students').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Grad', lastName: 'Student', email: `grad.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD,
      department: deptId, program: programId, academicYear: ayId, currentSection: secId,
      rollNumber: `GRAD-${RUN}`, admissionDate: '2025-07-01', batchYear: 2025,
    });
    expect(stuRes.statusCode).toBe(201);
    stuId = stuRes.body.data._id;
    createdUserIds.push(stuRes.body.data.user._id);

    const course = await Course.create({
      name: 'Algorithms', code: `ALG${RUN.slice(-4)}`, department: deptId, program: programId,
      semesterNumber: 1, type: 'theory', credits: 4, totalMarks: 100, passingMarks: 40,
    });
    courseId = course._id;

    const enrollRes = await request(app).post('/api/v1/enrollments').set('Authorization', `Bearer ${adminToken}`).send({
      student: stuId, course: courseId, section: secId, semester: semId, academicYear: ayId,
    });
    expect(enrollRes.statusCode).toBe(201);

    const markRes = await request(app).post('/api/v1/marks').set('Authorization', `Bearer ${adminToken}`).send({
      student: stuId, course: courseId, semester: semId, academicYear: ayId, marksType: 'total', maxMarks: 100, obtainedMarks: 92,
    });
    expect(markRes.statusCode).toBe(201);
    await request(app).patch(`/api/v1/marks/${markRes.body.data._id}/approve`)
      .set('Authorization', `Bearer ${adminToken}`).send({ decision: 'approved' });

    const genRes = await request(app).post('/api/v1/results/generate').set('Authorization', `Bearer ${adminToken}`).send({
      student: stuId, semester: semId, academicYear: ayId,
    });
    expect(genRes.statusCode).toBe(201);
    await request(app).patch(`/api/v1/results/${genRes.body.data._id}/publish`).set('Authorization', `Bearer ${adminToken}`);

    // Mark Student graduated & close AcademicYear -> verify historical academic records remain intact
    await request(app).patch(`/api/v1/students/${stuId}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'graduated', graduationDate: '2026-06-30' });
    await request(app).patch(`/api/v1/academic-years/${ayId}`).set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'completed', isCurrent: false });

    const historyRes = await request(app)
      .get(`/api/v1/students/${stuId}/academic-history`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.body.data.student.status).toBe('graduated');
    expect(historyRes.body.data.enrollments.length).toBe(1);
    expect(historyRes.body.data.semesterResults.length).toBe(1);
    expect(historyRes.body.data.semesterResults[0].sgpa).toBe(10);

    // Configurable lateFinePerDay fee calculation
    await request(app).post('/api/v1/settings').set('Authorization', `Bearer ${adminToken}`)
      .send({ key: 'fee.lateFinePerDay', value: 75, dataType: 'number', group: 'fee', isPublic: true });

    const fsRes = await request(app).post('/api/v1/fees/structures').set('Authorization', `Bearer ${adminToken}`).send({
      name: `Late Fee Struct ${RUN}`, program: programId, academicYear: ayId, year: 1,
      components: [{ name: 'Tuition', amount: 10000 }], dueDate: '2025-08-01',
    });
    expect(fsRes.statusCode).toBe(201);
    feeStructureId = fsRes.body.data._id;

    const assignRes = await request(app).post('/api/v1/fees/records/assign').set('Authorization', `Bearer ${adminToken}`).send({
      feeStructure: feeStructureId, studentIds: [stuId], semester: semId, dueDate: '2025-08-01',
    });
    feeRecordId = assignRes.body.data[0]._id;

    const fineRes = await request(app).post('/api/v1/fees/records/apply-late-fines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ academicYear: ayId, semester: semId, asOfDate: '2025-08-05' });
    expect(fineRes.statusCode).toBe(200);
    expect(fineRes.body.data.updatedCount).toBe(1);

    const recAfterFine = await request(app).get(`/api/v1/fees/records/${feeRecordId}`).set('Authorization', `Bearer ${adminToken}`);
    expect(recAfterFine.body.data.lateFine).toBe(300); // 4 days * 75
    expect(recAfterFine.body.data.totalDue).toBe(10300);
    expect(recAfterFine.body.data.status).toBe('overdue');
  });
});

