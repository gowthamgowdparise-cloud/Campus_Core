'use strict';

require('./setup');

const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/database');
const { ensureWithinRoot }        = require('../src/services/storage/localStorage.provider');
const { S3StorageProvider }       = require('../src/services/storage/s3Storage.provider');
const { validateUploadedFile }    = require('../src/middleware/upload');

const User             = require('../src/modules/users/user.model');
const Department       = require('../src/modules/departments/department.model');
const Program          = require('../src/modules/programs/program.model');
const AcademicYear     = require('../src/modules/academic-years/academicYear.model');
const Semester         = require('../src/modules/semesters/semester.model');
const Section          = require('../src/modules/sections/section.model');
const Course           = require('../src/modules/courses/course.model');
const CourseAssignment = require('../src/modules/courses/courseAssignment.model');
const CourseMaterial   = require('../src/modules/courses/courseMaterial.model');
const Enrollment       = require('../src/modules/enrollments/enrollment.model');
const Faculty          = require('../src/modules/faculty/faculty.model');
const Student          = require('../src/modules/students/student.model');
const Document         = require('../src/modules/documents/document.model');
const FeeStructure     = require('../src/modules/fees/feeStructure.model');
const FeeRecord        = require('../src/modules/fees/feeRecord.model');
const Payment          = require('../src/modules/payments/payment.model');
const Notification     = require('../src/modules/notifications/notification.model');
const AuditLog         = require('../src/modules/audit-logs/auditLog.model');

const RUN = `SP${Date.now()}`;
const PASSWORD = 'StorePay@2026!';

jest.setTimeout(30000);

describe('File Storage Pipeline, Security & Payment Provider / Webhook Integration', () => {
  const createdUserIds = [];
  let adminToken;
  let stu1Token;
  let stu2Token;
  let fac1Token;
  let fac2Token;

  let deptId;
  let programId;
  let ayId;
  let semId;
  let secId;
  let courseId;
  let fac1Id;
  let fac2Id;
  let stu1Id;
  let stu2Id;
  let feeStructureId;
  let feeRecordId;

  const originalEnvVars = {};

  beforeAll(async () => {
    await connectDB();

    const adminUser = await User.create({
      firstName: 'SP', lastName: 'Admin', email: `sp.admin.${RUN.toLowerCase()}@campuscore.edu`,
      role: 'admin', passwordHash: PASSWORD, status: 'active',
    });
    createdUserIds.push(adminUser._id);
    adminToken = (await request(app).post('/api/v1/auth/login').send({ email: adminUser.email, password: PASSWORD })).body.data.accessToken;

    const dept = await Department.create({ name: `Storage Dept ${RUN}`, code: `SD${RUN.slice(-5)}` });
    deptId = dept._id;
    const prog = await Program.create({
      name: `BTech SP ${RUN}`, code: `SP${RUN.slice(-5)}`, department: deptId, type: 'undergraduate', duration: 4, totalSemesters: 8,
    });
    programId = prog._id;
    const ay = await AcademicYear.create({ name: `AY-${RUN}`, startDate: '2026-07-01', endDate: '2027-06-30', status: 'active' });
    ayId = ay._id;
    const sem = await Semester.create({
      name: `Odd ${RUN}`, academicYear: ayId, type: 'odd', semesterNumber: 1,
      startDate: '2026-07-10', endDate: '2026-12-15', status: 'ongoing',
    });
    semId = sem._id;
    const sec = await Section.create({
      name: 'A', program: programId, department: deptId, academicYear: ayId, semester: semId, year: 1, semesterNumber: 1,
    });
    secId = sec._id;
    const course = await Course.create({
      name: 'Cloud Systems', code: `CS500${RUN.slice(-4)}`, department: deptId, program: programId,
      semesterNumber: 1, type: 'theory', credits: 4,
    });
    courseId = course._id;

    const [f1, f2, s1, s2] = await Promise.all([
      request(app).post('/api/v1/faculty').set('Authorization', `Bearer ${adminToken}`).send({
        firstName: 'Fac', lastName: 'One', email: `sp.f1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD,
        department: deptId, employeeId: `SPF1-${RUN}`, designation: 'professor', joiningDate: '2020-01-01',
      }),
      request(app).post('/api/v1/faculty').set('Authorization', `Bearer ${adminToken}`).send({
        firstName: 'Fac', lastName: 'Two', email: `sp.f2.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD,
        department: deptId, employeeId: `SPF2-${RUN}`, designation: 'lecturer', joiningDate: '2021-01-01',
      }),
      request(app).post('/api/v1/students').set('Authorization', `Bearer ${adminToken}`).send({
        firstName: 'Stu', lastName: 'One', email: `sp.s1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD,
        department: deptId, program: programId, academicYear: ayId, currentSection: secId,
        rollNumber: `SPS1-${RUN}`, admissionDate: '2026-07-01', batchYear: 2026,
      }),
      request(app).post('/api/v1/students').set('Authorization', `Bearer ${adminToken}`).send({
        firstName: 'Stu', lastName: 'Two', email: `sp.s2.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD,
        department: deptId, program: programId, academicYear: ayId, currentSection: secId,
        rollNumber: `SPS2-${RUN}`, admissionDate: '2026-07-01', batchYear: 2026,
      }),
    ]);

    fac1Id = f1.body.data._id;
    fac2Id = f2.body.data._id;
    stu1Id = s1.body.data._id;
    stu2Id = s2.body.data._id;
    createdUserIds.push(f1.body.data.user._id, f2.body.data.user._id, s1.body.data.user._id, s2.body.data.user._id);

    await CourseAssignment.create({
      faculty: fac1Id, course: courseId, section: secId, semester: semId, academicYear: ayId, assignedBy: adminUser._id,
    });
    await Enrollment.create({
      student: stu1Id, course: courseId, section: secId, semester: semId, academicYear: ayId, faculty: fac1Id,
    });

    const [lf1, lf2, ls1, ls2] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: `sp.f1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `sp.f2.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `sp.s1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `sp.s2.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
    ]);
    fac1Token = lf1.body.data.accessToken;
    fac2Token = lf2.body.data.accessToken;
    stu1Token = ls1.body.data.accessToken;
    stu2Token = ls2.body.data.accessToken;

    const fsDoc = await FeeStructure.create({
      name: `SP Fee ${RUN}`, program: programId, academicYear: ayId, year: 1,
      components: [{ name: 'Tuition', amount: 20000 }], totalAmount: 20000, createdBy: adminUser._id,
    });
    feeStructureId = fsDoc._id;
    const frDoc = await FeeRecord.create({
      student: stu1Id, feeStructure: feeStructureId, academicYear: ayId, semester: semId, totalDemand: 20000, createdBy: adminUser._id,
    });
    feeRecordId = frDoc._id;
  }, 25000);

  beforeEach(() => {
    for (const k of [
      'PAYMENT_PROVIDER', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_WEBHOOK_SECRET',
      'STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'MAX_FILE_SIZE_MB', 'S3_BUCKET', 'S3_REGION',
      'S3_ACCESS_KEY_ID', 'S3_SECRET_ACCESS_KEY',
    ]) {
      originalEnvVars[k] = process.env[k];
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
    for (const [k, v] of Object.entries(originalEnvVars)) {
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
  });

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        AuditLog.deleteMany({ actor: { $in: createdUserIds } }).setOptions({ allowCleanupInTest: true }),
        AuditLog.deleteMany({ action: 'PAYMENT_WEBHOOK_PROCESSED' }).setOptions({ allowCleanupInTest: true }),
        Notification.deleteMany({ recipient: { $in: createdUserIds } }),
        Payment.deleteMany({ student: { $in: [stu1Id, stu2Id].filter(Boolean) } }),
        FeeRecord.deleteMany({ _id: feeRecordId }),
        FeeStructure.deleteMany({ _id: feeStructureId }),
        Document.deleteMany({ owner: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
        CourseMaterial.deleteMany({ course: courseId }).setOptions({ includeDeleted: true }),
        Enrollment.deleteMany({ course: courseId }),
        CourseAssignment.deleteMany({ course: courseId }),
        Course.deleteMany({ _id: courseId }).setOptions({ includeDeleted: true }),
        Student.deleteMany({ _id: { $in: [stu1Id, stu2Id].filter(Boolean) } }).setOptions({ includeDeleted: true }),
        Faculty.deleteMany({ _id: { $in: [fac1Id, fac2Id].filter(Boolean) } }).setOptions({ includeDeleted: true }),
        Section.deleteMany({ _id: secId }),
        Semester.deleteMany({ _id: semId }),
        AcademicYear.deleteMany({ _id: ayId }),
        Program.deleteMany({ _id: programId }).setOptions({ includeDeleted: true }),
        Department.deleteMany({ _id: deptId }).setOptions({ includeDeleted: true }),
        User.deleteMany({ _id: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
      ]);
      await disconnectDB();
      fs.rmSync(path.resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || 'uploads-test'), { recursive: true, force: true });
    }
  }, 25000);

  test('File Upload validation, magic bytes, traversal protection, S3 abstraction & authorized download/audit', async () => {
    // Path traversal blocked
    expect(() => ensureWithinRoot(path.resolve('uploads-test'), '../../.env')).toThrow('traversal');

    // Oversize rejected dynamically
    process.env.MAX_FILE_SIZE_MB = '1';
    expect(() =>
      validateUploadedFile({
        originalname: 'big.pdf',
        mimetype    : 'application/pdf',
        size        : 2 * 1024 * 1024,
        buffer      : Buffer.from('%PDF-1.4\n'),
      })
    ).toThrow('exceeds limit');
    delete process.env.MAX_FILE_SIZE_MB;

    // Missing S3 config fails explicitly (503) rather than mocking success
    const s3 = new S3StorageProvider();
    expect(() => s3.assertConfigured()).toThrow('not configured');

    // Spoofed executable disguised as .pdf rejected (400)
    const spoofRes = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${stu1Token}`)
      .field('title', 'Fake PDF')
      .field('type', 'other')
      .attach('file', Buffer.from('MZ\x90\x00fake-exe'), { filename: 'evil.pdf', contentType: 'application/pdf' });
    expect(spoofRes.statusCode).toBe(400);

    // Unsupported extension (.svg XSS risk) rejected (400)
    const svgRes = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${stu1Token}`)
      .field('title', 'SVG XSS')
      .field('type', 'other')
      .attach('file', Buffer.from('<svg></svg>'), { filename: 'xss.svg', contentType: 'image/svg+xml' });
    expect(svgRes.statusCode).toBe(400);

    // Missing file rejected (400)
    const noFileRes = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${stu1Token}`)
      .send({ title: 'No File', type: 'id_card' });
    expect(noFileRes.statusCode).toBe(400);

    // Real PDF upload succeeds
    const validPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Title (Bonafide) >>\nendobj\n%%EOF');
    const upRes = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${stu1Token}`)
      .field('title', 'Bonafide Application')
      .field('type', 'bonafide')
      .attach('file', validPdf, { filename: 'bonafide.pdf', contentType: 'application/pdf' });
    expect(upRes.statusCode).toBe(201);
    const docId = upRes.body.data._id;

    // Other student cannot download (403)
    const idorDl = await request(app)
      .get(`/api/v1/documents/${docId}/download`)
      .set('Authorization', `Bearer ${stu2Token}`);
    expect(idorDl.statusCode).toBe(403);

    // Owner downloads exact bytes & triggers DOCUMENT_ACCESS audit log
    const okDl = await request(app)
      .get(`/api/v1/documents/${docId}/download`)
      .set('Authorization', `Bearer ${stu1Token}`);
    expect(okDl.statusCode).toBe(200);
    expect(okDl.headers['x-content-type-options']).toBe('nosniff');
    expect(okDl.headers['content-disposition']).toContain('bonafide.pdf');

    // Unassigned faculty blocked from uploading course material (403)
    const unauthMat = await request(app)
      .post(`/api/v1/courses/${courseId}/materials`)
      .set('Authorization', `Bearer ${fac2Token}`)
      .field('title', 'Unassigned Slides')
      .field('semester', String(semId))
      .field('academicYear', String(ayId))
      .attach('file', validPdf, { filename: 'slides.pdf', contentType: 'application/pdf' });
    expect(unauthMat.statusCode).toBe(403);

    // Assigned faculty uploads course material and enrolled student downloads it (audited)
    const okMat = await request(app)
      .post(`/api/v1/courses/${courseId}/materials`)
      .set('Authorization', `Bearer ${fac1Token}`)
      .field('title', 'Lecture 1')
      .field('semester', String(semId))
      .field('academicYear', String(ayId))
      .attach('file', validPdf, { filename: 'lecture1.pdf', contentType: 'application/pdf' });
    expect(okMat.statusCode).toBe(201);

    const stuMatDl = await request(app)
      .get(`/api/v1/courses/materials/${okMat.body.data._id}/download`)
      .set('Authorization', `Bearer ${stu1Token}`);
    expect(stuMatDl.statusCode).toBe(200);

    // Non-enrolled student blocked from downloading course material (403)
    const nonEnrolledDl = await request(app)
      .get(`/api/v1/courses/materials/${okMat.body.data._id}/download`)
      .set('Authorization', `Bearer ${stu2Token}`);
    expect(nonEnrolledDl.statusCode).toBe(403);

    // Owner delete removes stored binary & soft-deletes record
    const delRes = await request(app)
      .delete(`/api/v1/documents/${docId}`)
      .set('Authorization', `Bearer ${stu1Token}`);
    expect(delRes.statusCode).toBe(200);
    const storedPath = path.resolve(process.cwd(), 'uploads-test', upRes.body.data.storageKey);
    expect(fs.existsSync(storedPath)).toBe(false);
  });

  test('Payment Gateway initiation guard, HMAC checkout verification, signed webhooks & idempotency', async () => {
    // 1. Default PAYMENT_PROVIDER=manual rejects online initiation cleanly (503)
    process.env.PAYMENT_PROVIDER = 'manual';
    const manualInit = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${stu1Token}`)
      .send({ feeRecord: String(feeRecordId), amount: 5000 });
    expect(manualInit.statusCode).toBe(503);

    // 2. Configure Razorpay test keys & mock external fetch order creation cleanly
    process.env.PAYMENT_PROVIDER        = 'razorpay';
    process.env.RAZORPAY_KEY_ID         = 'rzp_test_campuscore';
    process.env.RAZORPAY_KEY_SECRET     = 'rzp_test_secret_campuscore';
    process.env.RAZORPAY_WEBHOOK_SECRET = 'rzp_webhook_secret_campuscore';

    const mockOrderId1 = `order_rzp_1_${RUN}`;
    const mockOrderId2 = `order_rzp_2_${RUN}`;
    let orderCallCount = 0;
    jest.spyOn(global, 'fetch').mockImplementation(async () => {
      orderCallCount += 1;
      const oid = orderCallCount === 1 ? mockOrderId1 : mockOrderId2;
      return {
        ok  : true,
        json: async () => ({ id: oid, amount: 500000, currency: 'INR' }),
      };
    });

    // Initiate Payment #1 via student (amount 5000)
    const init1 = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${stu1Token}`)
      .send({ feeRecord: String(feeRecordId), amount: 5000, idempotencyKey: `INIT1-${RUN}` });
    expect(init1.statusCode).toBe(201);
    expect(init1.body.data.payment.status).toBe('pending');
    expect(init1.body.data.provider.providerOrderId).toBe(mockOrderId1);
    expect(JSON.stringify(init1.body)).not.toContain('rzp_test_secret_campuscore');
    const pay1Id = init1.body.data.payment._id;

    // Bad HMAC signature on /verify rejected (400)
    const badVerify = await request(app)
      .post(`/api/v1/payments/${pay1Id}/verify`)
      .set('Authorization', `Bearer ${stu1Token}`)
      .send({ providerOrderId: mockOrderId1, providerPaymentId: 'pay_bad', providerSignature: '0'.repeat(64) });
    expect(badVerify.statusCode).toBe(400);

    // Valid HMAC checkout verification credits FeeRecord atomically
    const rzpPayId1 = `pay_rzp_1_${RUN}`;
    const validSig1 = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${mockOrderId1}|${rzpPayId1}`)
      .digest('hex');

    const okVerify = await request(app)
      .post(`/api/v1/payments/${pay1Id}/verify`)
      .set('Authorization', `Bearer ${stu1Token}`)
      .send({ providerOrderId: mockOrderId1, providerPaymentId: rzpPayId1, providerSignature: validSig1 });
    expect(okVerify.statusCode).toBe(200);
    expect(okVerify.body.data.status).toBe('success');

    // Initiate Payment #2 (amount 5000) and settle via signed Razorpay webhook
    const init2 = await request(app)
      .post('/api/v1/payments/initiate')
      .set('Authorization', `Bearer ${stu1Token}`)
      .send({ feeRecord: String(feeRecordId), amount: 5000 });
    expect(init2.statusCode).toBe(201);

    const webhookBody = JSON.stringify({
      event  : 'payment.captured',
      payload: { payment: { entity: { id: `pay_rzp_2_${RUN}`, order_id: mockOrderId2 } } },
    });
    const badHook = await request(app)
      .post('/api/v1/payments/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', 'invalid_sig')
      .send(webhookBody);
    expect(badHook.statusCode).toBe(401);

    const hookSig = crypto
      .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
      .update(webhookBody)
      .digest('hex');

    const okHook = await request(app)
      .post('/api/v1/payments/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', hookSig)
      .set('x-razorpay-event-id', `evt_1_${RUN}`)
      .send(webhookBody);
    expect(okHook.statusCode).toBe(200);
    expect(okHook.body.data.duplicate).toBe(false);
    expect(okHook.body.data.status).toBe('success');

    // Replay duplicate webhook -> acknowledged idempotently with zero double credit
    const dupHook = await request(app)
      .post('/api/v1/payments/webhooks/razorpay')
      .set('Content-Type', 'application/json')
      .set('x-razorpay-signature', hookSig)
      .set('x-razorpay-event-id', `evt_1_${RUN}`)
      .send(webhookBody);
    expect(dupHook.statusCode).toBe(200);
    expect(dupHook.body.data.duplicate).toBe(true);

    const feeRes = await request(app).get('/api/v1/fees/me').set('Authorization', `Bearer ${stu1Token}`);
    expect(feeRes.body.data.summary.totalPaid).toBe(10000); // 5000 + 5000 only, not 15000!
    expect(feeRes.body.data.summary.totalDue).toBe(10000);

    // Stripe webhook expired timestamp rejected (401)
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_stripe';
    const expiredTs = Math.floor(Date.now() / 1000) - 600;
    const stripeBody = JSON.stringify({ id: 'evt_str_1', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
    const stripeSig = crypto.createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET).update(`${expiredTs}.${stripeBody}`).digest('hex');
    const badStripeHook = await request(app)
      .post('/api/v1/payments/webhooks/stripe')
      .set('Content-Type', 'application/json')
      .set('stripe-signature', `t=${expiredTs},v1=${stripeSig}`)
      .send(stripeBody);
    expect(badStripeHook.statusCode).toBe(401);
  });
});

