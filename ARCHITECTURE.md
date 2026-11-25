# CAMPUSCORE — Backend Architecture Documentation

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Technology Stack](#2-technology-stack)
3. [Folder Structure](#3-folder-structure)
4. [Database Collection Design](#4-database-collection-design)
5. [Model Relationships](#5-model-relationships)
6. [Database Transaction Strategy](#6-database-transaction-strategy)
7. [Authentication Flow](#7-authentication-flow)
8. [Authorization Strategy](#8-authorization-strategy)
9. [Role–Permission Matrix](#9-rolepermission-matrix)
10. [API Design Conventions](#10-api-design-conventions)
11. [Database Indexing Strategy](#11-database-indexing-strategy)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Configuration & Security](#13-configuration--security)

---

## 1. System Overview

CAMPUSCORE is a production-grade College ERP and Student Information Management System.  
It is a **backend-only** REST API. All frontend concerns are intentionally excluded.

```
Client (future React / Mobile) ──► REST API (Express + JWT) ──► MongoDB Atlas (Mongoose)
```

Three authenticated roles operate through one shared infrastructure:

| Role    | Description                                      |
|---------|--------------------------------------------------|
| ADMIN   | Full system control — user management, master data |
| FACULTY | Teaching, marks, attendance, assessments         |
| STUDENT | Read own data, submit grievances, view results   |

---

## 2. Technology Stack

| Layer             | Technology                            | Purpose                         |
|-------------------|---------------------------------------|---------------------------------|
| Runtime           | Node.js ≥18                           | Server runtime                  |
| Web Framework     | Express.js 4                          | REST API routing                |
| Database          | MongoDB 6+ / MongoDB Atlas            | Document store & replica set TX |
| ODM               | Mongoose 8                            | Schema modeling, populate & TX  |
| Authentication    | jsonwebtoken (JWT)                    | Access & refresh tokens         |
| Password Hashing  | bcryptjs                              | Credential hashing              |
| Validation        | Joi                                   | Request input validation        |
| Security          | Helmet, cors, express-mongo-sanitize  | HTTP security & sanitization    |
| Rate Limiting     | express-rate-limit                    | Brute-force protection          |
| Logging           | Winston + DailyRotateFile             | Structured log management       |
| HTTP Logging      | Morgan                                | Access log stream               |
| Compression       | compression                           | gzip response compression       |
| Config            | dotenv                                | Environment variable loading    |
| Linting           | ESLint (flat config)                  | Static code quality checks      |
| Testing           | Jest + Supertest                      | Unit and integration tests      |

---

## 3. Folder Structure

```
CAMPUS_CORE/
├── src/
│   ├── app.js                         Express application factory
│   ├── server.js                      HTTP server bootstrap + graceful shutdown
│   ├── config/
│   │   ├── index.js                   Centralised config (validated on startup)
│   │   ├── database.js                Mongoose connection + DB health status
│   │   ├── permissions.js             Permission constants & ROLE_PERMISSIONS map
│   │   └── systemDefaults.js          Fallback grading, attendance, enrollment & fee defaults
│   ├── middleware/
│   │   ├── authenticate.js            JWT Bearer verification → req.user
│   │   ├── authorize.js               RBAC, requirePermission, requireAnyPermission, requireOwnerOrAdmin
│   │   ├── validate.js                Joi request body/query/params validation
│   │   ├── upload.js                  Multer memory upload + magic-byte signature validation
│   │   ├── requestId.js               X-Request-Id correlation ID middleware
│   │   ├── rateLimiter.js             General API rate limit (excludes health probes & webhooks)
│   │   ├── authRateLimit.js           Strict auth endpoint rate limit
│   │   ├── errorHandler.js            Centralised error handler + Multer & prod 500 sanitization
│   │   ├── auditLogger.js             Non-blocking audit trail + security audit persistence
│   │   └── requestLogger.js           Morgan HTTP request logging with correlation IDs
│   ├── docs/
│   │   └── openapi.js                 OpenAPI 3.0.3 Swagger specification for all /api/v1 routes
│   ├── services/
│   │   ├── storage/                   LocalStorageProvider (dev/test) + S3StorageProvider (prod presigned URLs)
│   │   └── payments/                  RazorpayProvider + StripeProvider checkout/HMAC webhook verification
│   ├── validators/
│   │   ├── index.js                   Shared validator barrel exports
│   │   └── common.validator.js        ObjectId, id param, pagination, date range schemas
│   ├── routes/
│   │   ├── index.js                   Root /health, /health/live, /health/ready + versioned API mount
│   │   └── v1.routes.js               /api/v1 router registry (+ /docs Swagger UI & /docs.json)
│   ├── utils/
│   │   ├── AppError.js                Custom operational error class
│   │   ├── catchAsync.js              Async route error propagation
│   │   ├── apiResponse.js             Consistent JSON response envelopes
│   │   ├── logger.js                  Winston + DailyRotateFile logger with secret redaction
│   │   ├── queryHelpers.js            Pagination, whitelisted sorting & regex search filters
│   │   └── transaction.js             Reusable MongoDB ACID transaction helper (runInTransaction)
│   ├── modules/                       Feature modules (models + validators + services + controllers + routes)
│   │   ├── auth/                      JWT auth, refresh rotation, reuse detection, logout, change-password
│   │   ├── users/                     User account CRUD, role/status lifecycle, permission matrix
│   │   ├── students/                  Admissions (transactional User+Student+Section), profiles, academic history
│   │   ├── faculty/                   Faculty profiles (transactional User+Faculty), courses, students, timetable
│   │   ├── departments/               Department CRUD + transactional HOD assignment
│   │   ├── programs/                  Degree programs + semester credit caps
│   │   ├── academic-years/            AcademicYear + AcademicCalendarEvent CRUD
│   │   ├── semesters/                 Semester lifecycle + /current lookup
│   │   ├── sections/                  Class sections + transactional class teacher assignment
│   │   ├── courses/                   Course CRUD, CourseAssignment, binary CourseMaterial upload/download
│   │   ├── enrollments/               Course enrollment eligibility (prereqs, credit cap, duplicates) & bulk enroll
│   │   ├── attendance/                Sessions, edit windows, configurable policy, reports & corrections
│   │   ├── examinations/              Exam events, schedules & status transitions
│   │   ├── assessments/               Internal assessment CRUD scoped to faculty assignments & enrolled students
│   │   ├── marks/                     Single/bulk marks entry, submit/approve workflow & correction requests
│   │   ├── results/                   Transactional SGPA/CGPA generation, publication, backlogs & analytics
│   │   ├── fees/                      FeeStructure templates, batch FeeRecord assignment, concessions & late fines
│   │   ├── payments/                  Idempotent payments, receipts, reconciliation, provider orders & HMAC webhooks
│   │   ├── timetables/                Section timetables with faculty time-slot conflict checks
│   │   ├── announcements/             Role/dept/program/section-scoped announcements
│   │   ├── notifications/             Per-user notifications, unread counts, bulk dispatch
│   │   ├── documents/                 Authenticated binary Document upload, download & verification workflow
│   │   ├── grievances/                Auto-ticket grievances, internal/public comments, assignment & resolution
│   │   ├── reports/                   Institution, attendance, performance, fee & grievance reports
│   │   ├── audit-logs/                Admin-only immutable audit trail inspection
│   │   └── system/                    SystemSetting CRUD, typed validation & fallback helpers
│   └── scripts/
│       └── seedAdmin.js               One-time admin provisioning script
├── tests/
│   ├── setup.js                       Loads .env & enforces MONGODB_URI_TEST isolation
│   ├── connection.test.js             MongoDB Atlas URI isolation & connection tests
│   ├── utils.test.js                  AppError, apiResponse, config, transaction tests
│   ├── auth.tokens.test.js            JWT utility tests
│   ├── auth.api.test.js               Core API & auth endpoint integration tests
│   ├── models.test.js                 Schema/unit + Atlas DB integration checks
│   ├── middleware.test.js             validate, RBAC, permissions, errorHandler, catchAsync
│   ├── erp.admin-academic.test.js     Institutional, academic, enrollment, timetable & IDOR/RBAC tests
│   ├── erp.workflows.test.js          End-to-end attendance, marks, results, fees, comms, reports tests
│   ├── security-audit-db.test.js      Correlation IDs, fail-closed prod CORS, OpenAPI, AuditLog immutability, TX rollback, graduation history
│   └── storage-payments.test.js       Upload validation, magic bytes, traversal, S3/local storage, payment initiation & HMAC webhooks
├── eslint.config.js                   ESLint flat configuration
├── render.yaml                        Render Web Service Blueprint
├── .env.example                       Environment template (placeholders only)
├── .gitignore
├── package.json
├── README.md
├── ARCHITECTURE.md
├── API_DOCUMENTATION.md
├── DEPLOYMENT.md
├── TESTING.md
└── SECURITY.md
```

---

## 4. Database Collection Design

30 Mongoose models map to the following MongoDB collections:

| Collection                   | Model                       | Purpose                                                      |
|------------------------------|-----------------------------|--------------------------------------------------------------|
| users                        | User                        | Authentication identity & token families for all 3 roles     |
| students                     | Student                     | Student academic profile, personal details, CGPA & credits   |
| faculties                    | Faculty                     | Staff professional profile & HOD designation flag            |
| departments                  | Department                  | Organisational academic unit                                 |
| programs                     | Program                     | Degree programme (B.Tech, M.Tech, etc.) & credit rules       |
| academicyears                | AcademicYear                | Academic year (2025-26)                                      |
| academiccalendarevents       | AcademicCalendarEvent       | Institutional holidays, exams, registration & deadlines      |
| semesters                    | Semester                    | Odd/Even semester within an academic year                    |
| sections                     | Section                     | Class section / division & strength tracking                 |
| courses                      | Course                      | Individual subject / paper + prerequisites                   |
| courseassignments            | CourseAssignment            | Faculty ↔ Course ↔ Section ↔ Semester teaching assignment    |
| coursematerials              | CourseMaterial              | Uploaded lecture notes, slides & study resource metadata     |
| enrollments                  | Enrollment                  | Student ↔ Course ↔ Semester bridge + attendance/grade status |
| attendances                  | Attendance                  | Per-session attendance header + embedded student records     |
| attendancecorrectionrequests | AttendanceCorrectionRequest | Student/faculty attendance status correction workflow        |
| examinations                 | Examination                 | Exam event + embedded `examSchedule` course slots            |
| assessments                  | Assessment                  | Internal assessment component                                |
| marks                        | Marks                       | Per-student marks with submission & verification workflow    |
| markscorrectionrequests      | MarksCorrectionRequest      | Re-evaluation & marks correction request workflow            |
| results                      | Result                      | Semester-level aggregated SGPA/CGPA & course result card     |
| feestructures                | FeeStructure                | Master fee template per programme/year/category              |
| feerecords                   | FeeRecord                   | Individual student fee demand, concessions & balance         |
| payments                     | Payment                     | Idempotent payment receipt & reconciliation tracking         |
| timetables                   | Timetable                   | Weekly class schedule per section                            |
| announcements                | Announcement                | Role/department/program/section-scoped broadcasts            |
| notifications                | Notification                | Per-user in-app notifications with TTL expiration            |
| documents                    | Document                    | Student/user document metadata & verification tracking       |
| grievances                   | Grievance                   | Complaint tickets with internal/public comment threads       |
| auditlogs                    | AuditLog                    | Immutable action & security audit trail                      |
| systemsettings               | SystemSetting               | Configurable key-value institutional policy settings         |

---

## 5. Model Relationships

```
User ──(1:1)──► Student ──(many:1)──► Department
     ──(1:1)──► Faculty              ──(many:1)──► Program
                                     ──(many:1)──► AcademicYear
                                     ──(many:1)──► Section

AcademicYear ──(1:many)──► Semester
             ──(1:many)──► AcademicCalendarEvent
Program      ──(1:many)──► Section
Section      ──(1:many)──► Timetable

Course ──(many:1)──► Department / Program
       ──(many:many)──► Student  [via Enrollment]
       ──(many:many)──► Faculty  [via CourseAssignment]
       ──(1:many)──► CourseMaterial

Attendance ──(many:1)──► Course / Section / Semester / Faculty
           ──(embedded)──► AttendanceRecord[] → Student
           ──(1:many)──► AttendanceCorrectionRequest

Examination ──(embedded)──► ExamScheduleSlot[] → Course / Faculty
            ──(1:many)──► Marks / Result

Marks ──(1:many)──► MarksCorrectionRequest

FeeStructure ──(1:many)──► FeeRecord
FeeRecord    ──(1:many)──► Payment

Grievance ──(many:1)──► User
          ──(many:1)──► Student (optional)
          ──(embedded)──► GrievanceComment[]

AuditLog ──(many:1)──► User (nullable for anonymous security events)
```

---

## 6. Database Transaction Strategy

Multi-document state transitions execute atomically via `runInTransaction(workFn, txOptions)` in [`src/utils/transaction.js`](src/utils/transaction.js):
- Starts a Mongoose `ClientSession` via `mongoose.startSession()`.
- Executes `workFn(session)` inside `session.withTransaction(...)` with `readPreference: 'primary'`, `readConcern: { level: 'local' }`, and `writeConcern: { w: 'majority' }`.
- Retries transient transaction errors per the MongoDB driver specification, aborts on error, and closes the session in `finally`.

### Transactional Prompt 2 Workflows
- **Student Admission:** `User` creation + `Student` creation + `Section.currentStrength` increment.
- **Faculty Creation:** `User` creation + `Faculty` profile creation.
- **Department HOD / Section Class Teacher Assignment:** Updating `Department.hod` / `Section.classTeacher` alongside `Faculty.isHOD` / role metadata.
- **Bulk Course Enrollments:** Atomic batch creation across multiple students with prerequisite & credit cap validation.
- **Attendance Correction Approval:** Updating `AttendanceCorrectionRequest` status, updating `Attendance.records[]` + aggregate counts, and recalculating `Enrollment.attendancePercentage`.
- **Marks Correction Approval:** Updating `MarksCorrectionRequest` + `Marks` `obtainedMarks` / `effectiveMarks`.
- **Semester Result Generation & Publication:** Creating/updating `Result`, syncing `Enrollment.status/grade/gradePoint`, updating `Student.cgpa` & `totalCreditsEarned` on publish, and issuing student notifications.
- **Fee Assignment, Concessions, Idempotent Payments & Reconciliation:** Atomic updates across `Payment`, `FeeRecord.paidAmount`/`balanceDue`/`status`, and student notifications.

> **Deployment Note (Replica Set Requirement):** MongoDB multi-document ACID transactions require a replica set (such as MongoDB Atlas). Running against an uninitialized standalone local `mongod` instance without `--replSet` configured will cause `runInTransaction` operations to fail with a MongoDB transaction/replica-set error.

---

## 7. Authentication Flow

### Login
```
POST /api/v1/auth/login
  → Validate credentials (Joi schema)
  → Find user by email (+passwordHash, +refreshTokens)
  → bcryptjs.compare(password, hash)
  → Check account status === 'active' (blocks suspended, inactive, pending_verification)
  → generateAccessToken(15m) + generateRefreshToken(7d, uuid v4 family)
  → SHA-256 hash refresh token & store in user.refreshTokens (max 5 active devices)
  → Set refreshToken in httpOnly cookie
  → Return { accessToken, user (with permissions) } in response body
```

### Request Authentication
```
Every protected request:
  Authorization: Bearer <accessToken>
  → authenticate middleware:
      1. Extract Bearer token
      2. jwt.verify(token, ACCESS_SECRET) & verify type === 'access'
      3. Load User from DB (verify status === 'active' & not soft-deleted)
      4. Check passwordChangedAt > token.iat → force re-login
      5. Attach req.user = { id, email, role, permissions, … }
```

### Token Refresh
```
POST /api/v1/auth/refresh  (httpOnly cookie OR body.refreshToken)
  → jwt.verify(refreshToken, REFRESH_SECRET) & verify type === 'refresh'
  → Find user, check status === 'active' & passwordChangedAt
  → Lookup SHA-256(refreshToken) in user.refreshTokens
  → If NOT active, but family exists → REUSE DETECTED → revoke entire family
  → Revoke old token, issue new access + refresh tokens (same family)
  → Rotate cookie & DB store
```

### Logout & Password Change
```
POST /api/v1/auth/logout          → revoke single refresh token (cookie or body) & clear cookie
POST /api/v1/auth/logout-all      → revoke all refresh tokens & clear cookie
PATCH /api/v1/auth/change-password → verify current password, re-hash, update passwordChangedAt, revoke all sessions
GET /api/v1/auth/me               → return User with populated studentProfile / facultyProfile
```

---

## 8. Authorization Strategy

**Layer 1 – Authentication** (`authenticate`)  
Verifies JWT, validates active DB user, populates `req.user` (never trusts `role` or `userId` from `req.body`).

**Layer 2 – Role RBAC** (`authorize(...roles)`)  
Checks `req.user.role` against allowed roles.

**Layer 3 – Fine-Grained Permissions** (`requirePermission(...perms)` / `requireAnyPermission(...perms)`)  
Enforces permission constants defined in [`src/config/permissions.js`](src/config/permissions.js) via `ROLE_PERMISSIONS`.

**Layer 4 – Resource Ownership** (`requireOwnerOrAdmin(getOwnerId)`)  
Permits `admin` or the authenticated owner (`ownerId === req.user.id`).

---

## 9. Role–Permission Matrix & Configurable Institutional Policies

Fine-grained permissions are defined in [`src/config/permissions.js`](src/config/permissions.js) and mapped across `admin`, `faculty`, and `student` for all implemented modules (`auth`, `users`, `students`, `faculty`, `departments`, `programs`, `academic_years`, `academic_calendar`, `semesters`, `sections`, `courses`, `course_assignments`, `course_materials`, `enrollments`, `attendance`, `examinations`, `assessments`, `marks`, `results`, `fees`, `payments`, `timetables`, `announcements`, `notifications`, `documents`, `grievances`, `reports`, `audit_logs`, `settings`).

Default policy fallbacks in [`src/config/systemDefaults.js`](src/config/systemDefaults.js) (overridable via `SystemSetting` and resolved via [`src/modules/system/systemSettings.helper.js`](src/modules/system/systemSettings.helper.js)):
- `attendance.minimumPercentage` (`75`), `attendance.lateCountsAsPresent` (`true`), `attendance.editWindowHours` (`48`)
- `grading.passingPercentage` (`40`), `grading.maxGraceMarks` (`5`), `grading.scale` (`O:10`, `A+:9`, `A:8`, `B+:7`, `B:6`, `C:5`, `F:0`)
- `enrollment.defaultMaxCredits` (`30`), `enrollment.defaultMinCredits` (`12`)
- `fee.lateFinePerDay` (`50`)

---

## 10. API Design Conventions

- **Base Prefix:** `/api/v1/{resource}`
- **Health Checks:** `GET /health`, `GET /health/live` (liveness `200`), `GET /health/ready`, and `GET /api/v1/health` (`200` when MongoDB `readyState === 1`, `503` otherwise; omits internal DB name in `production`)
- **OpenAPI / Swagger:** Interactive docs at `GET /api/v1/docs` and raw specification at `GET /api/v1/docs.json`
- **Response Envelope:**
  - Success: `{ "status": "success", "message": "...", "data": {…}, "meta": {…} }`
  - Error: `{ "status": "fail" | "error", "message": "...", "requestId": "...", "details": [{ "field", "message" }] }`

See [`API_DOCUMENTATION.md`](API_DOCUMENTATION.md) for the complete endpoint specification.

---

## 11. Database Indexing Strategy

All unique constraints and compound indexes are declared cleanly via `Schema.index(...)` (zero duplicate index definitions):

| Collection                   | Key Indexes |
|------------------------------|-------------|
| users                        | `email` (unique), `role+status`, `isDeleted`, `studentProfile` (sparse), `facultyProfile` (sparse) |
| students                     | `rollNumber` (unique), `enrollmentNumber` (unique sparse), `admissionNumber` (unique sparse), `user` (unique), `department+program+currentSemester`, `batchYear+status` |
| faculties                    | `employeeId` (unique), `facultyCode` (unique sparse), `user` (unique), `department+designation`, `isHOD+department` |
| courseassignments            | `course+section+semester+faculty` (unique), `faculty+semester+isActive`, `section+semester` |
| coursematerials              | `course+semester+isPublished`, `faculty+semester`, `isDeleted` |
| academiccalendarevents       | `academicYear+startDate`, `semester+eventType`, `isDeleted` |
| enrollments                  | `student+course+semester` (unique), `course+semester`, `section+semester`, `faculty+semester` |
| attendances                  | `course+section+date+periodNumber+sessionType` (unique), `faculty+date`, `records.student+date` |
| attendancecorrectionrequests | `attendanceSession+student+status`, `student+createdAt`, `course+section+status` |
| marks                        | `student+course+semester+marksType+assessment+examination` (unique), `examination`, `assessment`, `isVerified` |
| markscorrectionrequests      | `marksRecord+status`, `student+createdAt`, `course+semester+status` |
| results                      | `student+semester` (unique), `academicYear+semester`, `isPublished` |
| feerecords                   | `student+academicYear+semester` (unique), `status`, `dueDate+status` |
| payments                     | `receiptNumber` (unique), `transactionId` (unique sparse), `idempotencyKey` (unique sparse), `webhookEventId` (unique sparse), `providerOrderId` (sparse), `providerPaymentId` (sparse), `student+paidAt`, `reconciliationStatus` |
| notifications                | `recipient+isRead+createdAt`, `recipient+type`, `expiresAt` (TTL `expireAfterSeconds: 0`) |
| grievances                   | `ticketNumber` (unique), `raisedBy+status`, `assignedTo+status`, `category+priority` |
| auditlogs                    | `actor+createdAt`, `action+module`, `entityType+entityId`, `requestId`, `createdAt`, `status` |

---

## 12. Error Handling Strategy

[`src/middleware/errorHandler.js`](src/middleware/errorHandler.js) maps:
- `AppError` → configured status code
- Malformed JSON `SyntaxError` → `400`
- Body size limit (`entity.too.large`) & `multer` `LIMIT_FILE_SIZE` → `413` (other `MulterError` → `400`)
- Mongoose `CastError` → `400`
- Mongoose duplicate key (`11000`) → `409`
- Mongoose `ValidationError` → `422`
- `JsonWebTokenError` / `TokenExpiredError` → `401`
- CORS origin rejection → `403` (`AppError`)
- Unhandled non-operational `500` errors → logged with Winston + `requestId`; generic `'Internal Server Error'` message and omitted stack trace in `production`

---

## 13. Configuration & Security

- Secrets read from `.env` (gitignored); `validateConfig()` enforces required variables, distinct >= 32-char JWT secrets in production, and placeholder rejection
- `MONGODB_URI_TEST` strictly isolates tests from `MONGODB_URI` (`tests/setup.js` rejects matching URIs)
- Refresh tokens are SHA-256 hashed in MongoDB and rotated with reuse detection + `AuditLog` security events
- Immutable `AuditLog` schema blocks updates and non-test deletions; `auditLogger` captures `requestId` and download access events
- `Helmet`, fail-closed production `cors`, `express-mongo-sanitize`, `compression`, `X-Request-Id`, secret-redacted logging, and rate limiting protect all endpoints (see [`SECURITY.md`](SECURITY.md))
