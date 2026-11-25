'use strict';

require('./setup');

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/database');

const User                  = require('../src/modules/users/user.model');
const Department            = require('../src/modules/departments/department.model');
const Program               = require('../src/modules/programs/program.model');
const AcademicYear          = require('../src/modules/academic-years/academicYear.model');
const AcademicCalendarEvent = require('../src/modules/academic-years/academicCalendar.model');
const Semester              = require('../src/modules/semesters/semester.model');
const Section               = require('../src/modules/sections/section.model');
const Course                = require('../src/modules/courses/course.model');
const CourseAssignment      = require('../src/modules/courses/courseAssignment.model');
const Faculty               = require('../src/modules/faculty/faculty.model');
const Student               = require('../src/modules/students/student.model');
const Enrollment            = require('../src/modules/enrollments/enrollment.model');
const Timetable             = require('../src/modules/timetables/timetable.model');
const AuditLog              = require('../src/modules/audit-logs/auditLog.model');

const RUN = `ADM${Date.now()}`;
const PASSWORD = 'ErpTest@2026!';

jest.setTimeout(30000);

describe('ERP Institutional, Academic & Authorization Workflows (Atlas Integration)', () => {
  let adminToken;
  let facultyToken;
  let otherFacultyToken;
  let studentToken;

  let deptId;
  let programId;
  let ayId;
  let semId;
  let sectionAId;
  let sectionBId;
  let fac1Id;
  let fac2Id;
  let stu1Id;
  let prereqCourseId;
  let advCourseId;
  let heavyCourseId;

  const createdUserIds = [];

  beforeAll(async () => {
    await connectDB();

    const adminEmail = `admin.${RUN.toLowerCase()}@campuscore.edu`;
    const adminUser = await User.create({
      firstName   : 'System',
      lastName    : 'Admin',
      email       : adminEmail,
      role        : 'admin',
      passwordHash: PASSWORD,
      status      : 'active',
    });
    createdUserIds.push(adminUser._id);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: adminEmail, password: PASSWORD });
    adminToken = loginRes.body.data.accessToken;
  }, 20000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await Promise.all([
        Timetable.deleteMany({ academicYear: ayId }),
        Enrollment.deleteMany({ academicYear: ayId }),
        CourseAssignment.deleteMany({ academicYear: ayId }),
        Course.deleteMany({ department: deptId }).setOptions({ includeDeleted: true }),
        Section.deleteMany({ academicYear: ayId }),
        AcademicCalendarEvent.deleteMany({ academicYear: ayId }).setOptions({ includeDeleted: true }),
        Semester.deleteMany({ academicYear: ayId }),
        AcademicYear.deleteMany({ _id: ayId }),
        Program.deleteMany({ _id: programId }).setOptions({ includeDeleted: true }),
        Student.deleteMany({ _id: stu1Id }).setOptions({ includeDeleted: true }),
        Faculty.deleteMany({ _id: { $in: [fac1Id, fac2Id].filter(Boolean) } }).setOptions({ includeDeleted: true }),
        Department.deleteMany({ _id: deptId }).setOptions({ includeDeleted: true }),
        AuditLog.deleteMany({ actor: { $in: createdUserIds } }).setOptions({ allowCleanupInTest: true }),
        User.deleteMany({ _id: { $in: createdUserIds } }).setOptions({ includeDeleted: true }),
      ]);
      await disconnectDB();
    }
  }, 20000);

  test('Admin creates Department, Program, AcademicYear, CalendarEvent, Semester, Faculty, Section, and Students transactionally', async () => {
    const deptRes = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: `Computer Science ${RUN}`, code: `CS${RUN.slice(-5)}`, establishedYear: 2010 });
    expect(deptRes.statusCode).toBe(201);
    deptId = deptRes.body.data._id;

    const progRes = await request(app)
      .post('/api/v1/programs')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : `BTech CSE ${RUN}`,
        code          : `BT${RUN.slice(-6)}`,
        department    : deptId,
        type          : 'undergraduate',
        duration      : 4,
        totalSemesters: 8,
        semesterConfig: [{ semesterNumber: 1, maxCredits: 6, minCredits: 2 }],
      });
    expect(progRes.statusCode).toBe(201);
    programId = progRes.body.data._id;

    const ayRes = await request(app)
      .post('/api/v1/academic-years')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name     : `AY-${RUN}`,
        startDate: '2026-07-01',
        endDate  : '2027-06-30',
        isCurrent: true,
        status   : 'active',
      });
    expect(ayRes.statusCode).toBe(201);
    ayId = ayRes.body.data._id;

    const calRes = await request(app)
      .post('/api/v1/academic-years/calendar/events')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title       : `Orientation ${RUN}`,
        academicYear: ayId,
        eventType   : 'orientation',
        startDate   : '2026-07-05',
        endDate     : '2026-07-06',
        targetRoles : ['all'],
      });
    expect(calRes.statusCode).toBe(201);

    const semRes = await request(app)
      .post('/api/v1/semesters')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : `Odd ${RUN}`,
        academicYear  : ayId,
        type          : 'odd',
        semesterNumber: 1,
        startDate     : '2026-07-10',
        endDate       : '2026-12-15',
        isCurrent     : true,
        status        : 'ongoing',
      });
    expect(semRes.statusCode).toBe(201);
    semId = semRes.body.data._id;

    // Create 2 Faculty members
    const fac1Res = await request(app)
      .post('/api/v1/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName  : 'Ada',
        lastName   : 'Lovelace',
        email      : `fac1.${RUN.toLowerCase()}@campuscore.edu`,
        password   : PASSWORD,
        department : deptId,
        employeeId : `EMP1-${RUN}`,
        designation: 'professor',
        joiningDate: '2020-01-10',
      });
    expect(fac1Res.statusCode).toBe(201);
    fac1Id = fac1Res.body.data._id;
    createdUserIds.push(fac1Res.body.data.user._id);

    // Duplicate employeeId prevented
    const dupFacRes = await request(app)
      .post('/api/v1/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName  : 'Dup',
        lastName   : 'Fac',
        email      : `facdup.${RUN.toLowerCase()}@campuscore.edu`,
        password   : PASSWORD,
        department : deptId,
        employeeId : `EMP1-${RUN}`,
        designation: 'lecturer',
        joiningDate: '2022-01-10',
      });
    expect(dupFacRes.statusCode).toBe(409);

    const fac2Res = await request(app)
      .post('/api/v1/faculty')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName  : 'Alan',
        lastName   : 'Turing',
        email      : `fac2.${RUN.toLowerCase()}@campuscore.edu`,
        password   : PASSWORD,
        department : deptId,
        employeeId : `EMP2-${RUN}`,
        designation: 'associate_professor',
        joiningDate: '2021-01-10',
      });
    expect(fac2Res.statusCode).toBe(201);
    fac2Id = fac2Res.body.data._id;
    createdUserIds.push(fac2Res.body.data.user._id);

    // Assign HOD transactionally
    const hodRes = await request(app)
      .patch(`/api/v1/departments/${deptId}/hod`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ hodId: fac1Id });
    expect(hodRes.statusCode).toBe(200);

    // Create 2 sections
    const secARes = await request(app)
      .post('/api/v1/sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : 'A',
        program       : programId,
        department    : deptId,
        academicYear  : ayId,
        semester      : semId,
        year          : 1,
        semesterNumber: 1,
        maxStrength   : 60,
      });
    expect(secARes.statusCode).toBe(201);
    sectionAId = secARes.body.data._id;

    const secBRes = await request(app)
      .post('/api/v1/sections')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : 'B',
        program       : programId,
        department    : deptId,
        academicYear  : ayId,
        semester      : semId,
        year          : 1,
        semesterNumber: 1,
        maxStrength   : 60,
      });
    expect(secBRes.statusCode).toBe(201);
    sectionBId = secBRes.body.data._id;

    // Admit Student into Section A (increments currentStrength to 1)
    const stuRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName     : 'Grace',
        lastName      : 'Hopper',
        email         : `stu1.${RUN.toLowerCase()}@campuscore.edu`,
        password      : PASSWORD,
        department    : deptId,
        program       : programId,
        academicYear  : ayId,
        currentSection: sectionAId,
        rollNumber    : `ROLL1-${RUN}`,
        admissionDate : '2026-07-01',
        batchYear     : 2026,
      });
    expect(stuRes.statusCode).toBe(201);
    stu1Id = stuRes.body.data._id;
    createdUserIds.push(stuRes.body.data.user._id);

    // Duplicate rollNumber prevented
    const dupStuRes = await request(app)
      .post('/api/v1/students')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName     : 'Dup',
        lastName      : 'Student',
        email         : `studup.${RUN.toLowerCase()}@campuscore.edu`,
        password      : PASSWORD,
        department    : deptId,
        program       : programId,
        academicYear  : ayId,
        rollNumber    : `ROLL1-${RUN}`,
        admissionDate : '2026-07-01',
        batchYear     : 2026,
      });
    expect(dupStuRes.statusCode).toBe(409);

    // Login faculty and student
    const [f1Login, f2Login, s1Login] = await Promise.all([
      request(app).post('/api/v1/auth/login').send({ email: `fac1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `fac2.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
      request(app).post('/api/v1/auth/login').send({ email: `stu1.${RUN.toLowerCase()}@campuscore.edu`, password: PASSWORD }),
    ]);
    facultyToken      = f1Login.body.data.accessToken;
    otherFacultyToken = f2Login.body.data.accessToken;
    studentToken      = s1Login.body.data.accessToken;
  }, 20000);

  test('Courses, Faculty Assignments, Enrollment Eligibility (Prerequisites, Credit Cap, Duplicate) and Timetables', async () => {
    const c1Res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : 'Intro to Programming',
        code          : `CS101${RUN.slice(-4)}`,
        department    : deptId,
        program       : programId,
        semesterNumber: 1,
        type          : 'theory',
        credits       : 4,
      });
    expect(c1Res.statusCode).toBe(201);
    prereqCourseId = c1Res.body.data._id;

    const c2Res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : 'Data Structures',
        code          : `CS201${RUN.slice(-4)}`,
        department    : deptId,
        program       : programId,
        semesterNumber: 1,
        type          : 'theory',
        credits       : 2,
        prerequisites : [prereqCourseId],
      });
    expect(c2Res.statusCode).toBe(201);
    advCourseId = c2Res.body.data._id;

    const c3Res = await request(app)
      .post('/api/v1/courses')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name          : 'Heavy Course',
        code          : `CS301${RUN.slice(-4)}`,
        department    : deptId,
        program       : programId,
        semesterNumber: 1,
        type          : 'theory',
        credits       : 4,
      });
    expect(c3Res.statusCode).toBe(201);
    heavyCourseId = c3Res.body.data._id;

    // Assign fac1 to CS101 Section A
    const assignRes = await request(app)
      .post('/api/v1/courses/assignments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        faculty     : fac1Id,
        course      : prereqCourseId,
        section     : sectionAId,
        semester    : semId,
        academicYear: ayId,
      });
    expect(assignRes.statusCode).toBe(201);

    // Prerequisite check: student cannot enroll in CS201 before completing CS101
    const prereqFailRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        course      : advCourseId,
        section     : sectionAId,
        semester    : semId,
        academicYear: ayId,
      });
    expect(prereqFailRes.statusCode).toBe(400);

    // Student enrolls in CS101 (4 credits <= max 6)
    const enroll1Res = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        course      : prereqCourseId,
        section     : sectionAId,
        semester    : semId,
        academicYear: ayId,
      });
    expect(enroll1Res.statusCode).toBe(201);

    // Duplicate enrollment blocked (409)
    const dupEnrollRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({
        course      : prereqCourseId,
        section     : sectionAId,
        semester    : semId,
        academicYear: ayId,
      });
    expect(dupEnrollRes.statusCode).toBe(409);

    // Credit limit check: CS101 (4) + Heavy Course (4) = 8 > max 6 -> blocked
    const creditFailRes = await request(app)
      .post('/api/v1/enrollments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        student     : stu1Id,
        course      : heavyCourseId,
        section     : sectionAId,
        semester    : semId,
        academicYear: ayId,
      });
    expect(creditFailRes.statusCode).toBe(400);

    // Timetable creation + Faculty conflict prevention
    const tt1Res = await request(app)
      .post('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        section      : sectionAId,
        semester     : semId,
        academicYear : ayId,
        effectiveFrom: '2026-07-10',
        status       : 'published',
        schedule     : [
          {
            day    : 'Mon',
            periods: [{ periodNumber: 1, startTime: '09:00', endTime: '09:50', course: prereqCourseId, faculty: fac1Id, room: 'R101' }],
          },
        ],
      });
    expect(tt1Res.statusCode).toBe(201);

    // Conflicting timetable for Section B using same fac1 on Mon period 1 -> 409
    const ttConflictRes = await request(app)
      .post('/api/v1/timetables')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        section      : sectionBId,
        semester     : semId,
        academicYear : ayId,
        effectiveFrom: '2026-07-10',
        schedule     : [
          {
            day    : 'Mon',
            periods: [{ periodNumber: 1, startTime: '09:00', endTime: '09:50', course: prereqCourseId, faculty: fac1Id, room: 'R102' }],
          },
        ],
      });
    expect(ttConflictRes.statusCode).toBe(409);

    // Student and assigned faculty can fetch /timetables/me
    const stuTt = await request(app).get('/api/v1/timetables/me').set('Authorization', `Bearer ${studentToken}`);
    expect(stuTt.statusCode).toBe(200);
    expect(stuTt.body.data.length).toBeGreaterThanOrEqual(1);

    const facTt = await request(app).get('/api/v1/faculty/me/timetable').set('Authorization', `Bearer ${facultyToken}`);
    expect(facTt.statusCode).toBe(200);
    expect(facTt.body.data.length).toBeGreaterThanOrEqual(1);
  }, 30000);

  test('Role, Permission, IDOR and Privilege Escalation Protection', async () => {
    // Student cannot create department
    const stuDeptRes = await request(app)
      .post('/api/v1/departments')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ name: 'Hacker Dept', code: 'HACK' });
    expect(stuDeptRes.statusCode).toBe(403);

    // Student cannot update protected academic fields via /students/me
    const stuEscalateRes = await request(app)
      .patch('/api/v1/students/me')
      .set('Authorization', `Bearer ${studentToken}`)
      .send({ cgpa: 10, rollNumber: 'HACKED' });
    // Stripped by Joi -> empty body rejected with 422
    expect(stuEscalateRes.statusCode).toBe(422);

    // Unassigned faculty (fac2) cannot access stu1 (enrolled only in fac1's section/course)
    const unassignedFacStuRes = await request(app)
      .get(`/api/v1/students/${stu1Id}`)
      .set('Authorization', `Bearer ${otherFacultyToken}`);
    expect(unassignedFacStuRes.statusCode).toBe(403);

    // Assigned faculty (fac1) CAN view stu1
    const assignedFacStuRes = await request(app)
      .get(`/api/v1/students/${stu1Id}`)
      .set('Authorization', `Bearer ${facultyToken}`);
    expect(assignedFacStuRes.statusCode).toBe(200);

    // Faculty cannot publish results (403)
    const facPublishRes = await request(app)
      .post('/api/v1/results/generate')
      .set('Authorization', `Bearer ${facultyToken}`)
      .send({ student: stu1Id, semester: semId, academicYear: ayId });
    expect(facPublishRes.statusCode).toBe(403);

    // Student cannot access /audit-logs (403)
    const stuAuditRes = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${studentToken}`);
    expect(stuAuditRes.statusCode).toBe(403);

    // Admin can access /audit-logs and responses never contain passwordHash
    const adminAuditRes = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminAuditRes.statusCode).toBe(200);
    expect(JSON.stringify(adminAuditRes.body)).not.toContain('passwordHash');
  }, 30000);
});

