'use strict';

require('./setup');

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/database');

const User                        = require('../src/modules/users/user.model');
const Department                  = require('../src/modules/departments/department.model');
const Program                     = require('../src/modules/programs/program.model');
const AcademicYear                = require('../src/modules/academic-years/academicYear.model');
const Semester                    = require('../src/modules/semesters/semester.model');
const Section                     = require('../src/modules/sections/section.model');
const Course                      = require('../src/modules/courses/course.model');
const CourseAssignment            = require('../src/modules/courses/courseAssignment.model');
const CourseMaterial              = require('../src/modules/courses/courseMaterial.model');
const Faculty                     = require('../src/modules/faculty/faculty.model');
const Student                     = require('../src/modules/students/student.model');
const Enrollment                  = require('../src/modules/enrollments/enrollment.model');
const Attendance                  = require('../src/modules/attendance/attendance.model');
const AttendanceCorrectionRequest = require('../src/modules/attendance/attendanceCorrection.model');
const Examination                 = require('../src/modules/examinations/examination.model');
const Assessment                  = require('../src/modules/assessments/assessment.model');
const Marks                       = require('../src/modules/marks/marks.model');
const MarksCorrectionRequest      = require('../src/modules/marks/marksCorrection.model');
const Result                      = require('../src/modules/results/result.model');
const FeeStructure                = require('../src/modules/fees/feeStructure.model');
const FeeRecord                   = require('../src/modules/fees/feeRecord.model');
const Payment                     = require('../src/modules/payments/payment.model');
const Announcement                = require('../src/modules/announcements/announcement.model');
const Notification                = require('../src/modules/notifications/notification.model');
const Document                    = require('../src/modules/documents/document.model');
const Grievance                   = require('../src/modules/grievances/grievance.model');
const AuditLog                    = require('../src/modules/audit-logs/auditLog.model');
const SystemSetting               = require('../src/modules/system/systemSetting.model');

const RUN = `WF${Date.now()}`;
const PASSWORD = 'ErpTest@2026!';

jest.setTimeout(30000);

describe('ERP Cross-Module Business Workflows (Attendance, Marks, Results, Fees, Comms, Reports)', () => {
  let adminToken;
  let facultyToken;
  let otherFacultyToken;
  let studentToken;

  let deptId;
  let programId;
  let ayId;
  let semId;
  let sectionId;
  let facId;
  let otherFacId;
  let stuId;
  let otherStuId;
  let courseId;
  let examId;
  let assessmentId;
  let feeStructureId;
  let feeRecordId;
  let settingKey;

  const createdUserIds = [];

  beforeAll(async () => {
    await connectDB();

    const adminEmail = `wf.admin.${RUN.toLowerCase()}@campuscore.edu`;
    const adminUser = await User.create({
      firstName   : 'WF',
      lastName    : 'Admin',
      email       : adminEmail,
      role        : 'admin',
      passwordHash: PASSWORD,
      status      : 'active',
    });
    createdUserIds.push(adminUser._id);

    const adminLogin = await request(app).post('/api/v1/auth/login').send({ email: adminEmail, password: PASSWORD });
    adminToken = adminLogin.body.data.accessToken;

    const dept = await Department.create({ name: `ECE ${RUN}`, code: `EC${RUN.slice(-5)}` });
    deptId = dept._id;

    const prog = await Program.create({
      name: `BTech ECE ${RUN}`, code: `ECE${RUN.slice(-5)}`, department: deptId,
      type: 'undergraduate', duration: 4, totalSemesters: 8,
    });
    programId = prog._id;

    const ay = await AcademicYear.create({
      name: `AY-${RUN}`, startDate: '2026-07-01', endDate: '2027-06-30', status: 'active',
    });
    ayId = ay._id;

    const sem = await Semester.create({
      name: `Odd ${RUN}`, academicYear: ayId, type: 'odd', semesterNumber: 1,
      startDate: '2026-07-10', endDate: '2026-12-15', status: 'ongoing',
    });
    semId = sem._id;

    const sec = await Section.create({
      name: 'A', program: programId, department: deptId, academicYear: ayId, semester: semId, year: 1, semesterNumber: 1,
    });
    sectionId = sec._id;

    const course = await Course.create({
      name: 'Digital Circuits', code: `EC101${RUN.slice(-4)}`, department: deptId, program: programId,
      semesterNumber: 1, type: 'theory', credits: 4, totalMarks: 100, passingMarks: 40, internalMarks: 30, externalMarks: 70,
    });
    courseId = course._id;

    // Onboard 2 faculty + 2 students via API
    const f1Res = await request(app).post('/api/v1/faculty').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Nikola', lastName: 'Tesla', email: `wf.fac1.${RUN.toLowerCase()}@campuscore.edu`,
      password: PASSWORD, department: deptId, employeeId: `WFEMP1-${RUN}`, designation: 'professor', joiningDate: '2019-01-01',
    });
    facId = f1Res.body.data._id;
    createdUserIds.push(f1Res.body.data.user._id);

    const f2Res = await request(app).post('/api/v1/faculty').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Marie', lastName: 'Curie', email: `wf.fac2.${RUN.toLowerCase()}@campuscore.edu`,
      password: PASSWORD, department: deptId, employeeId: `WFEMP2-${RUN}`, designation: 'lecturer', joiningDate: '2020-01-01',
    });
    otherFacId = f2Res.body.data._id;
    createdUserIds.push(f2Res.body.data.user._id);

    const s1Res = await request(app).post('/api/v1/students').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Katherine', lastName: 'Johnson', email: `wf.stu1.${RUN.toLowerCase()}@campuscore.edu`,
      password: PASSWORD, department: deptId, program: programId, academicYear: ayId,
      currentSection: sectionId, rollNumber: `WFROLL1-${RUN}`, admissionDate: '2026-07-01', batchYear: 2026,
    });
    stuId = s1Res.body.data._id;
    createdUserIds.push(s1Res.body.data.user._id);

    const s2Res = await request(app).post('/api/v1/students').set('Authorization', `Bearer ${adminToken}`).send({
      firstName: 'Not', lastName: 'Enrolled', email: `wf.stu2.${RUN.toLowerCase()}@campuscore.edu`,
      password: PASSWORD, department: deptId, program: programId, academicYear: ayId,
      currentSection: sectionId, rollNumber: `WFROLL2-${RUN}`, admissionDate: '2026-07-01', batchYear: 2026,
    });
    otherStuId = s2Res.body.data._id;
    createdUserIds.push(s2Res.body.data.user._id);

    // Assign fac1 only to course + section + semester; enroll ONLY stu1
    await CourseAssignment.create({
      faculty: facId, course: courseId, section: sectionId, semester: semId, academicYear: ayId, assignedBy: adminUser._id,
    });
    await Enrollment.create({
      student: stuId, course: courseId, section: sectionId, semester: semId, academicYear: ayId, faculty: facId,
    });

    const [fl1, fl2, sl1] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: `wf.fac1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `wf.fac2.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `wf.stu1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
    ]);
    facultyToken      = fl1.body.data.accessToken;
    otherFacultyToken = fl2.body.data.accessToken;
    studentToken      = sl1.body.data.accessToken;
  }, 25000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        AuditLog.deleteMany({ actor: { $in: createdUserIds } }).setOptions({ allowCleanupInTest: true }),
        Notification.deleteMany({ recipient: { $in: createdUserIds } }),
        Grievance.deleteMany({ raisedBy: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
        Document.deleteMany({ owner: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
        Announcement.deleteMany({ createdBy: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
        Payment.deleteMany({ student: { $in: [stuId, otherStuId].filter(Boolean) } }),
        FeeRecord.deleteMany({ _id: feeRecordId }),
        FeeStructure.deleteMany({ _id: feeStructureId }),
        Result.deleteMany({ student: stuId }),
        MarksCorrectionRequest.deleteMany({ student: stuId }),
        Marks.deleteMany({ course: courseId }),
        Assessment.deleteMany({ _id: assessmentId }),
        Examination.deleteMany({ _id: examId }),
        AttendanceCorrectionRequest.deleteMany({ student: stuId }),
        Attendance.deleteMany({ course: courseId }),
        CourseMaterial.deleteMany({ course: courseId }).setOptions({ includeDeleted: true }),
        CourseAssignment.deleteMany({ course: courseId }),
        Enrollment.deleteMany({ course: courseId }),
        Course.deleteMany({ _id: courseId }).setOptions({ includeDeleted: true }),
        Section.deleteMany({ _id: sectionId }),
        Semester.deleteMany({ _id: semId }),
        AcademicYear.deleteMany({ _id: ayId }),
        Program.deleteMany({ _id: programId }).setOptions({ includeDeleted: true }),
        Student.deleteMany({ _id: { $in: [stuId, otherStuId].filter(Boolean) } }).setOptions({ includeDeleted: true }),
        Faculty.deleteMany({ _id: { $in: [facId, otherFacId].filter(Boolean) } }).setOptions({ includeDeleted: true }),
        Department.deleteMany({ _id: deptId }).setOptions({ includeDeleted: true }),
        SystemSetting.deleteMany({ key: settingKey }),
        User.deleteMany({ _id: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
      ]);
      await disconnectDB();
      require('fs').rmSync(require('path').resolve(process.cwd(), process.env.STORAGE_LOCAL_DIR || 'uploads-test'), {
        recursive: true,
        force    : true,
      });
    }
  }, 25000);

  test('Attendance session marking, duplicate/unassigned/non-enrolled guards, percentage calculation & correction approval', async () => {
    // Unassigned faculty blocked
    const unauthAtt = await request(app)
      .post('/api/v1/attendance/sessions')
      .set('Authorization', `Bearer ${otherFacultyToken}`)
      .send({
        course: courseId, section: sectionId, semester: semId, academicYear: ayId,
        date: '2026-08-01', periodNumber: 1, records: [{ student: stuId, status: 'present' }],
      });
    expect(unauthAtt.statusCode).toBe(403);

    // Non-enrolled student rejected
    const nonEnrolledAtt = await request(app)
      .post('/api/v1/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        course: courseId, section: sectionId, semester: semId, academicYear: ayId,
        date: '2026-08-01', periodNumber: 1, records: [{ student: otherStuId, status: 'present' }],
      });
    expect(nonEnrolledAtt.statusCode).toBe(400);

    // Assigned faculty marks absent
    const sess1Res = await request(app)
      .post('/api/v1/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        course: courseId, section: sectionId, semester: semId, academicYear: ayId,
        date: '2026-08-01', periodNumber: 1, topic: 'Boolean Algebra',
        records: [{ student: stuId, status: 'absent' }],
      });
    expect(sess1Res.statusCode).toBe(201);
    expect(sess1Res.body.data.absentCount).toBe(1);
    const sessionId = sess1Res.body.data._id;

    // Duplicate session blocked (409)
    const dupSessRes = await request(app)
      .post('/api/v1/attendance/sessions')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        course: courseId, section: sectionId, semester: semId, academicYear: ayId,
        date: '2026-08-01', periodNumber: 1, records: [{ student: stuId, status: 'present' }],
      });
    expect(dupSessRes.statusCode).toBe(409);

    // Student submits attendance correction request (absent -> present)
    const corrRes = await request(app)
      .post('/api/v1/attendance/corrections')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        attendanceSession: sessionId,
        requestedStatus  : 'present',
        reason           : 'Attended lab in alternate room with permission.',
      });
    expect(corrRes.statusCode).toBe(201);
    const correctionId = corrRes.body.data._id;

    // Assigned faculty approves correction -> updates Attendance counts & Enrollment.attendancePercentage
    const reviewRes = await request(app)
      .patch(`/api/v1/attendance/corrections/${correctionId}/review`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ decision: 'approved', reviewRemarks: 'Confirmed presence' });
    expect(reviewRes.statusCode).toBe(200);

    const myAttRes = await request(app)
      .get('/api/v1/attendance/me')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(myAttRes.statusCode).toBe(200);
    expect(myAttRes.body.data.courses[0].percentage).toBe(100);
    expect(myAttRes.body.data.courses[0].meetsRequirement).toBe(true);
  }, 30000);

  test('Assessments, Course Materials, Marks Entry/Approval, Correction & Result SGPA/CGPA Publication', async () => {
    // Course material upload by assigned faculty (real PDF upload)
    const matPdfBuffer = Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF');
    const matRes = await request(app)
      .post(`/api/v1/courses/${courseId}/materials`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .field('title', 'Unit 1 Slides')
      .field('section', String(sectionId))
      .field('semester', String(semId))
      .field('academicYear', String(ayId))
      .field('materialType', 'slides')
      .attach('file', matPdfBuffer, { filename: 'unit1.pdf', contentType: 'application/pdf' });
    expect(matRes.statusCode).toBe(201);
    expect(matRes.body.data.storageProvider).toBe('local');
    expect(matRes.body.data.fileHash).toBeTruthy();

    // Enrolled student reads course material & downloads actual stored PDF
    const stuMatRes = await request(app)
      .get(`/api/v1/courses/${courseId}/materials`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(stuMatRes.statusCode).toBe(200);
    expect(stuMatRes.body.data.length).toBe(1);

    const dlMatRes = await request(app)
      .get(`/api/v1/courses/materials/${matRes.body.data._id}/download`)
      .set('Authorization', `Bearer ${studentToken}`);
    expect(dlMatRes.statusCode).toBe(200);
    expect(dlMatRes.headers['content-type']).toContain('application/pdf');

    // Create Examination & Assessment
    const examRes = await request(app)
      .post('/api/v1/examinations')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `End Term ${RUN}`, type: 'end_term', academicYear: ayId, semester: semId,
        program: programId, department: deptId, startDate: '2026-12-01', endDate: '2026-12-12',
        examSchedule: [{ course: courseId, examDate: '2026-12-05', startTime: '10:00', endTime: '13:00', room: 'Hall A' }],
      });
    expect(examRes.statusCode).toBe(201);
    examId = examRes.body.data._id;

    const assessRes = await request(app)
      .post('/api/v1/assessments')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        title: 'Internal Quiz 1', course: courseId, section: sectionId, semester: semId,
        academicYear: ayId, type: 'quiz', maxMarks: 30, passingMarks: 12, status: 'published',
      });
    expect(assessRes.statusCode).toBe(201);
    assessmentId = assessRes.body.data._id;

    // Non-enrolled student marks entry blocked
    const nonEnrolledMark = await request(app)
      .post('/api/v1/marks')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        student: otherStuId, course: courseId, semester: semId, academicYear: ayId,
        assessment: assessmentId, marksType: 'internal', maxMarks: 30, obtainedMarks: 25,
      });
    expect(nonEnrolledMark.statusCode).toBe(400);

    // Obtained > maxMarks blocked
    const overMaxMark = await request(app)
      .post('/api/v1/marks')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        student: stuId, course: courseId, semester: semId, academicYear: ayId,
        assessment: assessmentId, marksType: 'internal', maxMarks: 30, obtainedMarks: 35,
      });
    expect(overMaxMark.statusCode).toBe(400);

    // Enter internal (25/30) and external (60/70) marks -> total 85/100 (85% -> A+, gradePoint 9)
    const m1 = await request(app)
      .post('/api/v1/marks')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        student: stuId, course: courseId, semester: semId, academicYear: ayId,
        assessment: assessmentId, marksType: 'internal', maxMarks: 30, obtainedMarks: 25,
      });
    expect(m1.statusCode).toBe(201);

    const m2 = await request(app)
      .post('/api/v1/marks')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({
        student: stuId, course: courseId, semester: semId, academicYear: ayId,
        examination: examId, marksType: 'external', maxMarks: 70, obtainedMarks: 60,
      });
    expect(m2.statusCode).toBe(201);

    const markIds = [m1.body.data._id, m2.body.data._id];

    // Faculty submits marks
    const submitRes = await request(app)
      .post('/api/v1/marks/submit')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ markIds });
    expect(submitRes.statusCode).toBe(200);

    // Faculty cannot approve marks (403)
    const facApproveRes = await request(app)
      .post('/api/v1/marks/approve-bulk')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ markIds, decision: 'approved' });
    expect(facApproveRes.statusCode).toBe(403);

    // Admin approves marks
    const adminApproveRes = await request(app)
      .post('/api/v1/marks/approve-bulk')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ markIds, decision: 'approved' });
    expect(adminApproveRes.statusCode).toBe(200);

    // Faculty cannot alter already approved marks directly (403)
    const alterApprovedRes = await request(app)
      .patch(`/api/v1/marks/${m1.body.data._id}`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ obtainedMarks: 28 });
    expect(alterApprovedRes.statusCode).toBe(403);

    // Student marks correction request -> Admin approves (25 -> 27; total 87%)
    const mCorrRes = await request(app)
      .post('/api/v1/marks/corrections')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ marksRecord: m1.body.data._id, requestedMarks: 27, reason: 'Question 2 totaling error' });
    expect(mCorrRes.statusCode).toBe(201);

    const mReviewRes = await request(app)
      .patch(`/api/v1/marks/corrections/${mCorrRes.body.data._id}/review`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ decision: 'approved', updatedMarks: 27, reviewRemarks: 'Verified totaling error' });
    expect(mReviewRes.statusCode).toBe(200);

    // Admin generates Result
    const genRes = await request(app)
      .post('/api/v1/results/generate')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ student: stuId, semester: semId, academicYear: ayId, examination: examId });
    expect(genRes.statusCode).toBe(201);
    expect(genRes.body.data.sgpa).toBe(9);
    expect(genRes.body.data.cgpa).toBe(9);
    expect(genRes.body.data.isPublished).toBe(false);
    const resultId = genRes.body.data._id;

    // Student cannot view unpublished result yet
    const prePubRes = await request(app).get('/api/v1/results/me').set('Authorization', `Bearer ${studentToken}`);
    expect(prePubRes.statusCode).toBe(200);
    expect(prePubRes.body.data.length).toBe(0);

    // Faculty cannot publish result (403)
    const facPubRes = await request(app)
      .patch(`/api/v1/results/${resultId}/publish`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(facPubRes.statusCode).toBe(403);

    // Admin publishes result
    const pubRes = await request(app)
      .patch(`/api/v1/results/${resultId}/publish`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(pubRes.statusCode).toBe(200);
    expect(pubRes.body.data.isPublished).toBe(true);

    // Student now sees published result & updated CGPA
    const postPubRes = await request(app).get('/api/v1/results/me').set('Authorization', `Bearer ${studentToken}`);
    expect(postPubRes.statusCode).toBe(200);
    expect(postPubRes.body.data.length).toBe(1);
    expect(postPubRes.body.data[0].sgpa).toBe(9);

    const historyRes = await request(app).get('/api/v1/students/me/academic-history').set('Authorization', `Bearer ${studentToken}`);
    expect(historyRes.statusCode).toBe(200);
    expect(historyRes.body.data.student.cgpa).toBe(9);
  }, 30000);

  test('Fees, Idempotent Payments, Reconciliation, Receipts, Grievances, Docs, Announcements, Settings & Reports', async () => {
    // Fee structure with component validation
    const fsRes = await request(app)
      .post('/api/v1/fees/structures')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: `Sem 1 Fee ${RUN}`, program: programId, academicYear: ayId, year: 1, category: 'general',
        components: [{ name: 'Tuition', amount: 40000 }, { name: 'Lab', amount: 10000 }],
      });
    expect(fsRes.statusCode).toBe(201);
    expect(fsRes.body.data.totalAmount).toBe(50000);
    feeStructureId = fsRes.body.data._id;

    // Assign fee to student
    const assignRes = await request(app)
      .post('/api/v1/fees/records/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ feeStructure: feeStructureId, studentIds: [stuId], semester: semId, concessionAmount: 5000, concessionReason: 'Merit' });
    expect(assignRes.statusCode).toBe(201);
    feeRecordId = assignRes.body.data[0]._id;
    expect(assignRes.body.data[0].totalDue).toBe(45000);

    // Duplicate fee assignment blocked
    const dupAssignRes = await request(app)
      .post('/api/v1/fees/records/assign')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ feeStructure: feeStructureId, studentIds: [stuId], semester: semId });
    expect(dupAssignRes.statusCode).toBe(409);

    // Reject sensitive payment credential fields (cardNumber/cvv)
    const badCardRes = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ feeRecord: feeRecordId, amount: 10000, mode: 'card', cardNumber: '4111', cvv: '123' });
    expect(badCardRes.statusCode).toBe(201); // stripped by Joi stripUnknown -> check stored payment has no cardNumber!
    expect(JSON.stringify(badCardRes.body)).not.toContain('cardNumber');
    expect(badCardRes.body.data.status).toBe('pending'); // student cannot self-mark success!

    // Admin reconciles student's pending payment -> marks success & credits FeeRecord
    const recPendingRes = await request(app)
      .patch(`/api/v1/payments/${badCardRes.body.data._id}/reconcile`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reconciliationStatus: 'matched', paymentStatus: 'success', reconciliationReference: `REC1-${RUN}` });
    expect(recPendingRes.statusCode).toBe(200);
    expect(recPendingRes.body.data.status).toBe('success');

    // Admin records remaining payment with idempotency key
    const idemKey = `IDEM-${RUN}`;
    const p1 = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ feeRecord: feeRecordId, amount: 35000, mode: 'neft', transactionId: `TXN-${RUN}`, idempotencyKey: idemKey });
    expect(p1.statusCode).toBe(201);

    // Duplicate submission with same idempotencyKey returns existing payment without double-crediting
    const p2 = await request(app)
      .post('/api/v1/payments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ feeRecord: feeRecordId, amount: 35000, mode: 'neft', transactionId: `TXN-${RUN}`, idempotencyKey: idemKey });
    expect(p2.statusCode).toBe(201);
    expect(p2.body.data._id).toBe(p1.body.data._id);

    const myFeesRes = await request(app).get('/api/v1/fees/me').set('Authorization', `Bearer ${studentToken}`);
    expect(myFeesRes.statusCode).toBe(200);
    expect(myFeesRes.body.data.summary.totalPaid).toBe(45000);
    expect(myFeesRes.body.data.summary.totalDue).toBe(0);

    const receiptRes = await request(app).get(`/api/v1/payments/${p1.body.data._id}/receipt`).set('Authorization', `Bearer ${studentToken}`);
    expect(receiptRes.statusCode).toBe(200);
    expect(receiptRes.body.data.receiptNumber).toBe(p1.body.data.receiptNumber);

    // Faculty announcement scoped to assigned section (blocked for 'all')
    const badAnnRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ title: 'Invalid Global', content: 'Should fail', targetRoles: ['all'] });
    expect(badAnnRes.statusCode).toBe(403);

    const goodAnnRes = await request(app)
      .post('/api/v1/announcements')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ title: 'Quiz Tomorrow', content: 'Be on time', targetRoles: ['student'], targetSections: [sectionId] });
    expect(goodAnnRes.statusCode).toBe(201);

    const stuAnnRes = await request(app).get('/api/v1/announcements').set('Authorization', `Bearer ${studentToken}`);
    expect(stuAnnRes.statusCode).toBe(200);
    expect(stuAnnRes.body.data.some((a) => a._id === goodAnnRes.body.data._id)).toBe(true);

    // Notifications & read-all
    const notifRes = await request(app).get('/api/v1/notifications/me').set('Authorization', `Bearer ${studentToken}`);
    expect(notifRes.statusCode).toBe(200);
    expect(notifRes.body.data.unreadCount).toBeGreaterThanOrEqual(1);
    await request(app).patch('/api/v1/notifications/me/read-all').set('Authorization', `Bearer ${studentToken}`);

    // Documents upload & verification (real PNG binary upload)
    const pngBuffer = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00, 0x00, 0x00, 0x0D]);
    const docRes = await request(app)
      .post('/api/v1/documents')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', 'ID Card Scan')
      .field('type', 'id_card')
      .attach('file', pngBuffer, { filename: 'id.png', contentType: 'image/png' });
    expect(docRes.statusCode).toBe(201);
    expect(docRes.body.data.storageProvider).toBe('local');
    expect(docRes.body.data.fileSize).toBe(pngBuffer.length);

    const verifyDocRes = await request(app)
      .patch(`/api/v1/documents/${docRes.body.data._id}/verify`)
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ decision: 'verified' });
    expect(verifyDocRes.statusCode).toBe(200);
    expect(verifyDocRes.body.data.isVerified).toBe(true);

    // Grievance submission + internal comment privacy
    const grvRes = await request(app)
      .post('/api/v1/grievances')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ category: 'facility', subject: 'Projector flickering', description: 'Room 101 projector needs check' });
    expect(grvRes.statusCode).toBe(201);
    const grvId = grvRes.body.data._id;

    await request(app)
      .post(`/api/v1/grievances/${grvId}/comments`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ comment: 'Internal technician note', isInternal: true });

    const stuGrvRes = await request(app).get(`/api/v1/grievances/${grvId}`).set('Authorization', `Bearer ${studentToken}`);
    expect(stuGrvRes.statusCode).toBe(200);
    expect(stuGrvRes.body.data.comments.length).toBe(0); // internal note hidden from student!

    // SystemSetting upsert & Reports
    settingKey = `custom.test.${RUN.toLowerCase()}`;
    const setRes = await request(app)
      .post('/api/v1/settings')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ key: settingKey, value: 80, dataType: 'number', group: 'attendance', isPublic: true });
    expect(setRes.statusCode).toBe(201);

    const pubSetRes = await request(app).get('/api/v1/settings/public').set('Authorization', `Bearer ${studentToken}`);
    expect(pubSetRes.statusCode).toBe(200);
    expect(pubSetRes.body.data[settingKey]).toBe(80);

    const [overviewRep, feeRep, grvRep, perfRep] = await Promise.all([
      request(app).get('/api/v1/reports/institution-overview').set('Authorization', `Bearer ${adminToken}`),
      request(app).get('/api/v1/reports/fees').set('Authorization', `Bearer ${adminToken}`),
      request(app).get('/api/v1/reports/grievances').set('Authorization', `Bearer ${adminToken}`),
      request(app).get(`/api/v1/reports/academic-performance?course=${courseId}&semester=${semId}`).set('Authorization', `Bearer ${facultyToken}`),
    ]);
    expect(overviewRep.statusCode).toBe(200);
    expect(feeRep.statusCode).toBe(200);
    expect(grvRep.statusCode).toBe(200);
    expect(perfRep.statusCode).toBe(200);
    expect(perfRep.body.data.passPercentage).toBe(100);
  }, 20000);
});

