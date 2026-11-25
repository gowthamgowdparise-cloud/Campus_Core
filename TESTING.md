# CAMPUSCORE — Testing Guide

> Complete automated unit and integration testing instructions for the CAMPUSCORE backend.

---

## 1. Isolated Test Environment Rules

- Tests load [`tests/setup.js`](tests/setup.js), which reads `.env` and **requires** `MONGODB_URI_TEST` to be distinct from `MONGODB_URI`.
- `src/config/database.js` routes `NODE_ENV=test` exclusively to `MONGODB_URI_TEST` (never falling back to `MONGODB_URI`).
- **Never** point `MONGODB_URI_TEST` at a production database; integration suites clean up their own generated documents after running.
- Local test file uploads write into `STORAGE_LOCAL_DIR=uploads-test` (gitignored) and are deleted in `afterAll`.

---

## 2. Running Tests & Linting

```bash
npm test                     # Run all Jest unit + MongoDB Atlas integration suites
npm run test:coverage        # Run all suites with coverage collection
npm run lint                 # Run ESLint across src/
npx eslint src tests         # Run ESLint across src/ and tests/
```

---

## 3. Test Suites Inventory

| Suite File | Type | What It Verifies |
|---|---|---|
| [`tests/connection.test.js`](tests/connection.test.js) | Unit + Atlas | `MONGODB_URI_TEST` isolation, disconnected state, live Atlas connection |
| [`tests/utils.test.js`](tests/utils.test.js) | Unit | `AppError`, `apiResponse`, pagination metadata, `validateConfig()`, `runInTransaction` unit mocks |
| [`tests/middleware.test.js`](tests/middleware.test.js) | Unit | Joi `validate` unknown-field stripping, RBAC `authorize`, `requirePermission`, `requireAnyPermission`, `requireOwnerOrAdmin`, `errorHandler`, `catchAsync` |
| [`tests/auth.tokens.test.js`](tests/auth.tokens.test.js) | Unit | JWT access/refresh generation, verification, type/family checks |
| [`tests/auth.api.test.js`](tests/auth.api.test.js) | Integration (Atlas) | `/health` 200/503, login, `pending_verification` block, refresh rotation via cookie, reuse detection & family revocation, logout, `change-password`, `logout-all` |
| [`tests/models.test.js`](tests/models.test.js) | Unit + Atlas | Zero duplicate schema indexes across Prompt 1 models, `User.toJSON()`, grievance sequence, attendance/marks integrity, transaction checks |
| [`tests/erp.admin-academic.test.js`](tests/erp.admin-academic.test.js) | Integration (Atlas) | Department/HOD, Program, AcademicYear/Calendar, Semester, Section strength, Faculty, Student admission, Courses, Assignments, Enrollments (prereqs, credit caps, duplicates), Timetables (conflict check), RBAC/IDOR/escalation |
| [`tests/erp.workflows.test.js`](tests/erp.workflows.test.js) | Integration (Atlas) | Attendance sessions/guards/percentage/corrections, Course material PDF upload/download, Assessments, Marks enter/submit/approve/corrections, Results SGPA/CGPA/publish, Fees/Payments/Reconciliation/Receipts, Announcements, Notifications, Documents, Grievances, SystemSettings, Reports |
| [`tests/security-audit-db.test.js`](tests/security-audit-db.test.js) | Unit + Atlas | `X-Request-Id` correlation IDs, fail-closed prod CORS, `/health/live` vs `/health/ready`, prod 500 error masking, log secret redaction, OpenAPI `/docs.json` & `/docs/`, `AuditLog` immutability, Atlas transaction rollback, student graduation & closed academic year history preservation, configurable late fines |
| [`tests/storage-payments.test.js`](tests/storage-payments.test.js) | Unit + Atlas | Local/S3 storage abstraction, missing S3 credential `503`, path traversal guard, size limit, magic-byte spoofing rejection, XSS extension rejection (`.svg`), authorized document & material downloads + audit logs, deletion cleanup, Razorpay/Stripe gateway initiation (`503` unconfigured, mocked `fetch` + real HMAC checkout verify + signed webhook verification + duplicate webhook idempotency + Stripe timestamp/HMAC guard) |

---

## 4. What Requires External Credentials / Live Dashboards

- **AWS S3 / R2 Presigned URLs**: `tests/storage-payments.test.js` verifies missing-credential guards (`503`) and local file roundtrips; live S3 bucket uploads/presigned downloads require real `S3_*` credentials.
- **Razorpay / Stripe Order Creation**: `createOrder` HTTP calls are mocked in `tests/storage-payments.test.js`, while HMAC-SHA256 signature verification and webhook idempotency run against real Node `crypto` digests. Live gateway testing requires sandbox/live keys in `.env`.

