CAMPUSCORE — Backend API

«Professional College ERP & Student Information Management System
Backend-only · Node.js · Express.js · MongoDB · JWT»

Student Details

Field| Details
Name| GOWTHAM GOWD
University| Sanskriti University
Admission Number| 2528604
Enrollment Number| 2502320237
Section| D
Project Name| CAMPUSCORE

---

Quick Start

Prerequisites

- Node.js ≥ 18 — "Download" (https://nodejs.org/)
- MongoDB ≥ 6 (MongoDB Atlas or local "mongod")
- npm ≥ 9

1. Install dependencies

npm install

2. Configure environment

cp .env.example .env

Edit ".env" and set at minimum:

Variable| Description
"MONGODB_URI"| Primary MongoDB connection string (Atlas SRV or local)
"MONGODB_URI_TEST"| Separate MongoDB test database connection string (used when "NODE_ENV=test")
"JWT_ACCESS_SECRET"| 64+ char random string
"JWT_REFRESH_SECRET"| Different 64+ char random string

Generate secure secrets:

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

«Security: Never commit ".env" (it is listed in ".gitignore") and never expose database credentials in logs or code.»

3. Create the initial admin account

# Set in .env first:
# INITIAL_ADMIN_EMAIL=admin@yourschool.edu
# INITIAL_ADMIN_PASSWORD=YourStr0ng!Pass
npm run seed:admin

«Remove "INITIAL_ADMIN_*" from ".env" after the first run.»

4. Start the server

npm run dev      # Development (nodemon)
npm start        # Production

Server starts at "http://localhost:5000"

5. Deploy to Render

See ""DEPLOYMENT.md"" (./DEPLOYMENT.md) and ""render.yaml"" (./render.yaml) for Render Web Service build/start commands ("npm ci" / "npm start"), Atlas connection setup, production CORS ("ALLOWED_ORIGINS"), and S3 storage setup.

---

Role Overview

- ADMIN: Full institutional administration, student/faculty onboarding, master setup, timetable publishing, marks approval, result generation & publication, fee assignment/concessions/late fines, manual reconciliation, audit logs, and "SystemSetting" governance.
- FACULTY: Class/course scoped operations via active "CourseAssignment" and "Section.classTeacher" links (take/update attendance within edit window, approve attendance corrections, upload course materials, create assessments, enter/submit marks, review marks corrections, view reports).
- STUDENT: Self-service scoped strictly to own records (profile self-update, course enrollment eligibility checks, view attendance/marks/published results/backlogs/timetable/fees/receipts, submit correction requests, initiate/verify payments, upload/download own documents, submit grievances).

---

Health Checks & Interactive API Docs

Reports liveness and MongoDB readiness ("200" when connected, "503" when degraded/disconnected; omits internal DB name & runtime details in "production"):

GET /health
GET /health/live
GET /health/ready
GET /api/v1/health
GET /api/v1/docs
GET /api/v1/docs.json

{
  "status": "ok",
  "service": "campuscore-api",
  "database": {
    "status": "connected",
    "isConnected": true
  },
  "time": "2026-11-25T09:00:00.000Z"
}

---

Authentication

All protected routes require:

Authorization: Bearer <accessToken>

Endpoint| Method| Auth| Description
"/api/v1/auth/login"| POST| Public| Login (any active role); sets "httpOnly" "refreshToken" cookie
"/api/v1/auth/refresh"| POST| Public| Rotate tokens using "httpOnly" cookie or JSON body "refreshToken"
"/api/v1/auth/logout"| POST| Required| Revoke refresh token (cookie or body) & clear cookie
"/api/v1/auth/logout-all"| POST| Required| Revoke all refresh tokens across all devices
"/api/v1/auth/me"| GET| Required| Current authenticated user profile (populated) & permissions
"/api/v1/auth/change-password"| PATCH| Required| Change password & revoke all active sessions

Login Example

curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@yourschool.edu","password":"YourStr0ng!Pass"}'

{
  "status": "success",
  "message": "Login successful",
  "data": {
    "accessToken": "<jwt>",
    "user": {
      "id": "...",
      "email": "admin@yourschool.edu",
      "role": "admin",
      "permissions": ["auth:read_self", "..."],
      "fullName": "System Administrator"
    }
  }
}

---

Running Tests & Linting

«Integration tests connect to "MONGODB_URI_TEST" from ".env" (never "MONGODB_URI"). Ensure Atlas/MongoDB replica-set access and IP allowlist are active before running tests.»

npm test
npm run test:coverage
npm run lint
npx eslint src tests

---

Implemented API Modules

All Prompt 2 ERP REST modules are mounted under "/api/v1" (with "/health" and "/api/v1/health" reporting live MongoDB readiness):

Category| Modules| Base Routes
Core & Identity| Health, Auth, Users| "/health", "/api/v1/auth", "/api/v1/users"
Profiles & Directory| Students, Faculty| "/api/v1/students", "/api/v1/faculty"
Institutional & Academic| Departments, Programs, Academic Years & Calendar, Semesters, Sections, Courses/Assignments/Materials| "/api/v1/departments", "/api/v1/programs", "/api/v1/academic-years", "/api/v1/semesters", "/api/v1/sections", "/api/v1/courses"
Teaching & Learning| Enrollments, Timetables, Attendance & Corrections| "/api/v1/enrollments", "/api/v1/timetables", "/api/v1/attendance"
Exams & Grading| Examinations, Assessments, Marks & Corrections, Results| "/api/v1/examinations", "/api/v1/assessments", "/api/v1/marks", "/api/v1/results"
Finance| Fees (Structures & Records), Payments & Reconciliation| "/api/v1/fees", "/api/v1/payments"
Communication & Support| Announcements, Notifications, Documents, Grievances| "/api/v1/announcements", "/api/v1/notifications", "/api/v1/documents", "/api/v1/grievances"
Analytics & Governance| Reports, Audit Logs, System Settings| "/api/v1/reports", "/api/v1/audit-logs", "/api/v1/settings"

See ""API_DOCUMENTATION.md"" (./API_DOCUMENTATION.md) for the complete endpoint reference, ""TESTING.md"" (./TESTING.md) for test suite details, ""DEPLOYMENT.md"" (./DEPLOYMENT.md) for Render/Atlas deployment instructions, and ""SECURITY.md"" (./SECURITY.md) for security controls.

Interactive Swagger/OpenAPI docs are served at "GET /api/v1/docs" (and raw JSON at "GET /api/v1/docs.json").

---

Operational Notes & Known Limitations

- Backend-Only Scope: This repository provides REST APIs only; there is no frontend, HTML, CSS, or client UI.
- MongoDB Replica Set Requirement: Multi-document state changes use "runInTransaction" ("session.withTransaction"). This requires a MongoDB replica set (such as MongoDB Atlas or a local "--replSet" setup documented in ""DEPLOYMENT.md"" (./DEPLOYMENT.md)) and fails on uninitialized standalone local "mongod" instances.
- File Storage Architecture ("STORAGE_PROVIDER"): Supports binary multipart uploads (".pdf", ".png", ".jpg", ".jpeg", ".webp", ".docx", ".pptx", ".xlsx", ".txt") with magic-byte validation, SHA-256 hashing, path-traversal protection, and authorized downloads via "LocalStorageProvider" ("uploads/" for dev/test only) or "S3StorageProvider" (private AWS S3 / R2 bucket + short-lived presigned URLs). Production S3 credentials must be supplied via Render environment variables before live file uploads work in production.
- Payments Architecture ("PAYMENT_PROVIDER"): Supports manual/reference fee payments, duplicate-proof "idempotencyKey", receipts, and admin reconciliation ("manual" default) plus an external gateway/webhook adapter ("razorpay" / "stripe") with raw-body HMAC signature verification and duplicate webhook protection. External gateway credentials ("RAZORPAY_*" or "STRIPE_*") must be configured before processing live online payments.
- Institutional Policy Configuration: Default values in ""src/config/systemDefaults.js"" (src/config/systemDefaults.js) (75% attendance minimum, 40% pass percentage, sample 10-point grading scale, 30 max credits, 50/day late fine) are fallback defaults only and must be reviewed and confirmed against official university regulations in "SystemSetting" prior to go-live.

---

Project & Security Documentation

- Architecture & Data Model: ""ARCHITECTURE.md"" (./ARCHITECTURE.md)
- Security Controls & Remaining Reviews: ""SECURITY.md"" (./SECURITY.md)
- Testing Guide: ""TESTING.md"" (./TESTING.md)
- Render & Atlas Deployment: ""DEPLOYMENT.md"" (./DEPLOYMENT.md)

---

Security Notes

- Never commit ".env" or expose database credentials; logs redact passwords, tokens, keys, CVVs, and URI secrets.
- Refresh tokens are SHA-256 hashed before storage, rotated per request, and trigger family-wide revocation + "AuditLog" alerts on reuse.
- Production CORS fails closed when "ALLOWED_ORIGINS" is empty; requests carry "X-Request-Id" correlation headers.
- Accounts in "suspended", "inactive", or "pending_verification" status are denied login/access.
- Rate limiting: 10 auth requests / 15 min, 100 API requests / 15 min (health & signed webhooks excluded).
- All passwords hashed with bcryptjs (salt rounds >= 10 enforced in production, default 12).
- NoSQL injection prevention via "express-mongo-sanitize", strict Joi validation, and "Helmet" security headers.
