# CAMPUSCORE — REST API Documentation (`/api/v1`)

> Backend-only REST API documentation for CAMPUSCORE (College ERP & Student Information Management System).

---

## General Conventions

- **Base URL:** `/api/v1` (plus root `GET /health`, `GET /health/live`, `GET /health/ready`, Swagger UI `GET /api/v1/docs`, OpenAPI JSON `GET /api/v1/docs.json`)
- **Correlation Header:** Every request receives an `X-Request-Id` response header (safe client `X-Request-Id` values echoed; invalid values replaced with UUID v4).
- **Authentication:** `Authorization: Bearer <accessToken>` on all protected endpoints (except `/auth/login`, `/auth/refresh`, `/health*`, `/docs*`, and HMAC-verified `/payments/webhooks/:provider`). Roles/user IDs in request bodies are ignored for caller identity.
- **Content-Type:** `application/json` (`1mb` default cap, unknown fields stripped by Joi) or `multipart/form-data` on file upload endpoints.
- **Success Envelope:**
```json
{
  "status": "success",
  "message": "Operation completed",
  "data": {},
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 }
}
```
- **Error Envelope:**
```json
{
  "status": "fail",
  "message": "Human-readable reason",
  "details": [{ "field": "email", "message": "must be a valid email" }]
}
```
- **HTTP Status Codes:** `200` OK, `201` Created, `400` Bad Request / Business Rule Violation, `401` Unauthorized, `403` Forbidden (RBAC / Permission / Scope / IDOR), `404` Not Found, `409` Conflict / Duplicate Key, `422` Validation Error, `429` Rate Limit Exceeded, `500` Server Error, `503` DB Disconnected.

---

## 1. Health, Docs & Auth (`/health`, `/api/v1/docs`, `/api/v1/auth`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/health`, `/health/ready`, `/api/v1/health` | Public | Readiness check reporting MongoDB connectivity (`200` connected, `503` degraded; omits DB name/env in `production`) |
| `GET` | `/health/live`, `/api/v1/health/live` | Public | Liveness probe (`200 ok`) |
| `GET` | `/api/v1/docs`, `/api/v1/docs.json` | Public | Interactive Swagger UI and OpenAPI 3.0.3 JSON specification |
| `POST` | `/api/v1/auth/login` | Public (auth rate limit) | Authenticate email + password for active user; sets `httpOnly` `refreshToken` cookie |
| `POST` | `/api/v1/auth/refresh` | Public (auth rate limit) | Rotate refresh token (cookie or JSON body) with token-family reuse detection |
| `GET` | `/api/v1/auth/me` | Authenticated (`auth:read_self`) | Return current authenticated user with populated profile and granted permissions |
| `POST` | `/api/v1/auth/logout` | Authenticated | Revoke supplied refresh token and clear cookie |
| `POST` | `/api/v1/auth/logout-all` | Authenticated | Revoke all refresh tokens across devices |
| `PATCH` | `/api/v1/auth/change-password` | Authenticated (`auth:change_password`) | Verify current password, hash new password, revoke all active refresh sessions |

---

## 2. Users (`/api/v1/users`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/users/roles/permissions` | `roles:read` | Return role list and configured `ROLE_PERMISSIONS` matrix |
| `GET` | `/api/v1/users` | `users:read` | Paginated user listing with role/status/search filters |
| `POST` | `/api/v1/users` | `users:create` | Create user account (admin-controlled) |
| `GET` | `/api/v1/users/:id` | Owner or Admin (`requireOwnerOrAdmin`) | Get user profile by ID |
| `PATCH` | `/api/v1/users/:id` | Owner or Admin (`requireOwnerOrAdmin`) | Update user fields (non-admins cannot escalate role/status) |
| `PATCH` | `/api/v1/users/:id/status` | `users:update` | Activate/deactivate/suspend user; revokes tokens on deactivation; prevents self-lockout |
| `PATCH` | `/api/v1/users/:id/role` | `users:update` | Change user role; revokes active tokens; prevents self-demotion |
| `DELETE` | `/api/v1/users/:id` | `users:delete` | Soft-delete user |

---

## 3. Students (`/api/v1/students`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/students/me` | `student` (`students:read_own`) | Fetch own student profile |
| `PATCH` | `/api/v1/students/me` | `student` | Self-update allowed contact/personal fields (blocks CGPA, rollNumber, program, status changes) |
| `GET` | `/api/v1/students/me/academic-history` | `student` (`students:read_own`) | View own enrollments, published results, CGPA, and credits |
| `GET` | `/api/v1/students` | `admin`, `faculty` (`students:read`) | List students (faculty scoped to assigned sections/courses) |
| `POST` | `/api/v1/students` | `admin` (`students:create`) | Transactional student admission (`User` + `Student` + `Section.currentStrength`) |
| `GET` | `/api/v1/students/:id` | `students:read` or `students:read_own` | Get student profile (enforces student self-only & faculty course/section assignment scoping) |
| `GET` | `/api/v1/students/:id/academic-history` | `students:read` or `students:read_own` | View student academic history (self, assigned faculty, or admin) |
| `PATCH` | `/api/v1/students/:id` | `admin` (`students:update`) | Update student academic/administrative details |
| `DELETE` | `/api/v1/students/:id` | `admin` (`students:delete`) | Soft-delete student |

---

## 4. Faculty (`/api/v1/faculty`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/faculty/me` | `faculty` | Fetch own faculty profile |
| `PATCH` | `/api/v1/faculty/me` | `faculty` | Update allowed personal/office-hour fields |
| `GET` | `/api/v1/faculty/me/courses` | `faculty` | List active `CourseAssignment` records assigned to current faculty |
| `GET` | `/api/v1/faculty/me/students` | `faculty` | List students enrolled in courses/sections assigned to current faculty |
| `GET` | `/api/v1/faculty/me/timetable` | `faculty` | View personal weekly teaching schedule extracted from published timetables |
| `GET` | `/api/v1/faculty` | `admin` (`faculty:read`) | Paginated list of all faculty |
| `POST` | `/api/v1/faculty` | `admin` (`faculty:create`) | Transactional `User` + `Faculty` creation |
| `GET` | `/api/v1/faculty/:id` | `admin`, `faculty` (`faculty:read`) | Get faculty record (faculty restricted to self unless admin) |
| `PATCH` | `/api/v1/faculty/:id` | `admin` (`faculty:update`) | Update faculty profile |
| `DELETE` | `/api/v1/faculty/:id` | `admin` (`faculty:delete`) | Soft-delete faculty |

---

## 5. Institutional & Academic Setup

### Departments (`/api/v1/departments`)
- `GET /` (`departments:read`) — List departments
- `GET /:id` (`departments:read`) — Department details with HOD summary
- `POST /` (`departments:manage`) — Create department
- `PATCH /:id` (`departments:manage`) — Update department
- `PATCH /:id/hod` (`departments:manage`) — Transactionally assign/swap department HOD (`Department.hod` & `Faculty.isHOD`)
- `DELETE /:id` (`departments:manage`) — Soft-delete (blocked if active students, faculty, courses, or programs depend on it)

### Programs (`/api/v1/programs`)
- `GET /` (`programs:read`), `GET /:id` (`programs:read`), `POST /` (`programs:manage`), `PATCH /:id` (`programs:manage`), `DELETE /:id` (`programs:manage`) — Degree program CRUD including `semesterConfig` max credit caps and dependency check on delete.

### Academic Years & Calendar (`/api/v1/academic-years`)
- `GET /calendar/events` (`academic_calendar:read`) — List calendar events (role-aware)
- `POST /calendar/events` (`academic_calendar:manage`) — Create event (`endDate >= startDate`)
- `PATCH /calendar/events/:eventId` (`academic_calendar:manage`) — Update calendar event
- `DELETE /calendar/events/:eventId` (`academic_calendar:manage`) — Soft-delete calendar event
- `GET /current` (`academic_years:read`) — Fetch active current `AcademicYear`
- `GET /`, `GET /:id` (`academic_years:read`) — List/get academic years
- `POST /`, `PATCH /:id`, `DELETE /:id` (`academic_years:manage`) — Academic year CRUD (`isCurrent` singleton coordination)

### Semesters (`/api/v1/semesters`)
- `GET /current` (`semesters:read`) — Active current semester
- `GET /`, `GET /:id` (`semesters:read`), `POST /`, `PATCH /:id` (`semesters:manage`) — Semester CRUD linked to `AcademicYear`

### Sections (`/api/v1/sections`)
- `GET /`, `GET /:id` (`sections:read`) — Role-scoped section list/details
- `POST /`, `PATCH /:id` (`sections:manage`) — Section CRUD & strength tracking
- `PATCH /:id/class-teacher` (`sections:manage`) — Assign faculty class teacher for a section

---

## 6. Courses, Assignments & Materials (`/api/v1/courses`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/courses` | `courses:read` | List courses with department/program/semester filters |
| `GET` | `/api/v1/courses/:id` | `courses:read` | Course details + prerequisites |
| `POST` | `/api/v1/courses` | `courses:manage` | Create course (validates prerequisite courses) |
| `PATCH` | `/api/v1/courses/:id` | `courses:manage` | Update course |
| `DELETE` | `/api/v1/courses/:id` | `courses:manage` | Soft-delete course |
| `GET` | `/api/v1/courses/assignments` | `course_assignments:read` | List faculty-course-section teaching assignments |
| `POST` | `/api/v1/courses/assignments` | `course_assignments:manage` | Assign faculty to teach course + section + semester |
| `DELETE` | `/api/v1/courses/assignments/:assignmentId` | `course_assignments:manage` | Remove/deactivate assignment |
| `GET` | `/api/v1/courses/:courseId/materials` | `course_materials:read` | List materials (students must be enrolled; unpublished hidden from students) |
| `POST` | `/api/v1/courses/:courseId/materials` | `course_materials:manage` | Upload binary course material (`multipart/form-data` field `file`, magic-byte validated & stored via `StorageProvider`) |
| `GET` | `/api/v1/courses/materials/:materialId/download` | `course_materials:read` | Authorized binary download (local stream or S3 presigned URL; audited as `COURSE_MATERIAL_ACCESS`) |
| `PATCH` | `/api/v1/courses/materials/:materialId` | `course_materials:manage` | Update material metadata (admin or uploading assigned faculty) |
| `DELETE` | `/api/v1/courses/materials/:materialId` | `course_materials:manage` | Soft-delete material and remove stored binary file |

---

## 7. Enrollments (`/api/v1/enrollments`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/enrollments/me` | `student` (`enrollments:read`) | List student's own course enrollments |
| `GET` | `/api/v1/enrollments` | `enrollments:read` | Admin/faculty scoped list of enrollments |
| `POST` | `/api/v1/enrollments` | `admin`, `student` | Enroll student after verifying: active status, matching program, prerequisite `completed` status, semester max credit cap (`Program.semesterConfig` or `enrollment.defaultMaxCredits`), and non-duplicate enrollment (`409`) |
| `POST` | `/api/v1/enrollments/bulk` | `admin` (`enrollments:manage`) | Transactional bulk enrollment across multiple students |
| `PATCH` | `/api/v1/enrollments/:id/drop` | `admin`, `student` | Drop course enrollment |
| `PATCH` | `/api/v1/enrollments/:id/status` | `admin` (`enrollments:manage`) | Transition enrollment status (`enrolled | completed | failed | dropped | detained | withdrawn`) |

---

## 8. Timetables (`/api/v1/timetables`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/timetables/me` | Authenticated (`timetables:read`) | Student's section published timetable or faculty's assigned teaching timetable |
| `GET` | `/api/v1/timetables` | `timetables:read` | List timetables |
| `GET` | `/api/v1/timetables/:id` | `timetables:read` | Timetable details |
| `POST` | `/api/v1/timetables` | `timetables:manage` | Create timetable (prevents faculty double-booking on same day/period/time within active timetables -> `409`) |
| `PATCH` | `/api/v1/timetables/:id` | `timetables:manage` | Update timetable schedule with conflict re-check |
| `PATCH` | `/api/v1/timetables/:id/publish` | `timetables:manage` | Publish draft timetable |

---

## 9. Attendance & Corrections (`/api/v1/attendance`)

| Method | Path | Access / Permissions | Purpose |
|---|---|---|---|
| `GET` | `/api/v1/attendance/policy` | `attendance:read` | Read effective `attendance.minimumPercentage`, `attendance.lateCountsAsPresent`, `attendance.editWindowHours` |
| `PUT` | `/api/v1/attendance/policy` | `admin` (`settings:manage`) | Update configurable attendance policy settings |
| `GET` | `/api/v1/attendance/me` | `student` (`attendance:read`) | Own per-course attendance breakdown & eligibility flag (`>= minimumPercentage`) |
| `GET` | `/api/v1/attendance/students/:studentId/summary` | `attendance:read` | Student attendance summary (self, assigned faculty, or admin) |
| `GET` | `/api/v1/attendance/reports` | `admin`, `faculty` (`attendance:read`) | Course/section shortage & aggregate attendance report |
| `GET` | `/api/v1/attendance/sessions` | `admin`, `faculty` (`attendance:read`) | List marked sessions |
| `POST` | `/api/v1/attendance/sessions` | `admin`, `faculty` (`attendance:mark`) | Create session (blocks duplicate session `409`, enforces faculty `CourseAssignment` & active course `Enrollment`) |
| `GET` | `/api/v1/attendance/sessions/:id` | `admin`, `faculty` (`attendance:read`) | Session details |
| `PATCH` | `/api/v1/attendance/sessions/:id` | `admin`, `faculty` (`attendance:mark`) | Update session (blocked if finalized or past `editWindowHours` for non-admin) |
| `PATCH` | `/api/v1/attendance/sessions/:id/finalize` | `admin`, `faculty` (`attendance:mark`) | Lock session against direct edits |
| `GET` | `/api/v1/attendance/corrections` | `attendance:read` | List correction requests (scoped by role) |
| `POST` | `/api/v1/attendance/corrections` | `attendance:correction_request` | Submit correction request |
| `PATCH` | `/api/v1/attendance/corrections/:id/review` | `admin`, `faculty` (`attendance:correction_approve`) | Transactionally approve/reject correction, update `Attendance` record counts, and recalculate `Enrollment.attendancePercentage` |

---

## 10. Examinations, Assessments, Marks & Results

### Examinations (`/api/v1/examinations`)
- `GET /`, `GET /:id` (`examinations:read`, students scoped to their program)
- `POST /`, `PATCH /:id`, `PATCH /:id/schedule`, `PATCH /:id/status` (`admin`, `examinations:manage`)

### Assessments (`/api/v1/assessments`)
- `GET /`, `GET /:id` (`assessments:read`, scoped by enrollment/assignment)
- `POST /`, `PATCH /:id`, `DELETE /:id` (`admin`, `faculty`, `assessments:manage`, faculty verified via `CourseAssignment`)

### Marks & Corrections (`/api/v1/marks`)
- `GET /me` (`student`, `marks:read`) — Student's own marks
- `GET /`, `POST /` (`marks:enter`), `POST /bulk` (`marks:enter`), `PATCH /:id` (`marks:enter`) — Entry validates faculty `CourseAssignment`, student `Enrollment`, `obtainedMarks <= maxMarks`, and `graceMarks <= grading.maxGraceMarks`; blocks direct edits after `approved` status for faculty (`403`)
- `POST /submit` (`admin`, `faculty`, `marks:submit`) — Mark draft entries `submitted`
- `POST /approve-bulk`, `PATCH /:id/approve` (`admin`, `marks:verify`) — Admin approval (`approved | rejected`)
- `GET /corrections`, `POST /corrections` (`marks:correction_request`), `PATCH /corrections/:id/review` (`admin`, `faculty`, `marks:correction_approve`) — Transactional marks correction review updating `Marks` effective marks

### Results (`/api/v1/results`)
- `GET /me`, `GET /me/backlogs` (`student`, `results:read`) — Published results only (`isPublished: true`) & backlog courses
- `GET /backlogs`, `GET /reports/class-performance` (`admin`, `faculty`)
- `GET /student/:studentId`, `GET /` (`results:read`) — Unpublished results hidden from students
- `POST /generate` (`admin`, `results:publish`) — Transactional SGPA, CGPA, grade, `gradePoint`, and `Enrollment` completion computation using configurable `grading.scale` and `grading.passingPercentage`
- `PATCH /:id/publish` (`admin`, `results:publish`) — Publishes result, updates `Student.cgpa` & `totalCreditsEarned`, and sends a student notification

---

## 11. Fees & Payments

### Fees (`/api/v1/fees`)
- `GET /me` (`student`, `fees:read_own`) — Student fee records & due/paid summary
- `GET /structures`, `GET /structures/:id` (`fees:manage` or `fees:read_own`) — Master fee templates
- `POST /structures`, `PATCH /structures/:id` (`admin`, `fees:manage`) — Validates non-empty component sums equal `totalAmount`
- `GET /records`, `GET /records/:id` (`fees:manage` or `fees:read_own`, student scoped to self)
- `POST /records/assign` (`admin`, `fees:manage`) — Transactionally creates `FeeRecord` rows (prevents duplicate student+year+semester) and notifies assigned students
- `PATCH /records/:id/concession` (`admin`, `fees:manage`) — Apply/update fee concession and recalculate balance
- `POST /records/apply-late-fines` (`admin`, `fees:manage`) — Evaluate overdue balances transactionally using `FeeStructure.lateFinePerDay` or configurable `fee.lateFinePerDay`

### Payments (`/api/v1/payments`)
- `GET /me` (`student`, `payments:read_own`) — Student payment history
- `GET /reconciliation/summary` (`admin`, `payments:reconcile`) — Aggregate matched/unreconciled/discrepancy summary
- `GET /`, `GET /:id`, `GET /:id/receipt` (`payments:manage` or `payments:read_own`, student owner-checked)
- `POST /` (`admin`, `student`) — Records manual/reference payment with atomic `FeeRecord` update when `status === 'success'` (students can only create `pending` reference requests; duplicate `idempotencyKey` returns existing payment without double-crediting; `cardNumber`/`cvv` rejected/stripped)
- `POST /initiate` (`admin`, `student`) — Initiate Razorpay/Stripe gateway order/intent (`503` when `PAYMENT_PROVIDER=manual` or keys missing)
- `POST /:id/verify` (`admin`, `student`) — Verify provider checkout HMAC signature and atomically settle balance
- `POST /webhooks/:provider` (Unauthenticated HMAC-verified provider webhook for `razorpay` / `stripe`; enforces raw-body HMAC verification, `webhookEventId` idempotency, transactional update & security audit log)
- `PATCH /:id/reconcile` (`admin`, `payments:reconcile`) — Marks reconciliation status (`matched | discrepancy | unreconciled`) and credits/reverses `FeeRecord` if transitioning payment status

---

## 12. Communications, Documents, Grievances, Reports, Audit Logs & Settings

### Announcements (`/api/v1/announcements`)
- `GET /` (`announcements:read`, filtered to caller's role/department/program/section & publish window)
- `POST /`, `PATCH /:id`, `DELETE /:id` (`admin`, `faculty` — faculty restricted from global `['all']` broadcasts and scoped to assigned sections)

### Notifications (`/api/v1/notifications`)
- `GET /me`, `GET /me/unread-count`, `PATCH /me/read-all`, `PATCH /me/:id/read` (`notifications:read`, strict `recipient === req.user.id`)
- `POST /` (`admin`, `notifications:manage`) — Bulk dispatch notifications

### Documents (`/api/v1/documents`)
- `GET /`, `GET /:id` (`documents:read`, student owner-checked), `POST /` (`documents:upload` — real `multipart/form-data` binary upload validated by extension/MIME/magic bytes and stored via `StorageProvider`), `GET /:id/download` (`documents:read` — authorized download stream or short-lived S3 presigned URL; audited as `DOCUMENT_ACCESS`), `PATCH /:id/verify` (`admin`, `faculty`, `documents:verify` — sends verification notification), `DELETE /:id` (`documents:read` — owner or admin soft delete + binary cleanup)

### Grievances (`/api/v1/grievances`)
- `GET /`, `GET /:id` (`grievances:read` — `isInternal: true` comments stripped from student responses), `POST /` (`grievances:create` — atomic ticket number `GRV-YYYYMMDD-XXXXXX`), `POST /:id/comments` (`GRIEVANCE_COMMENT_ADD` audited), `PATCH /:id/assign` (`admin`, `grievances:manage`), `PATCH /:id/status` (`admin`, `faculty` assigned or admin — notifies ticket owner)

### Reports (`/api/v1/reports`)
- `GET /institution-overview` (`admin`, `reports:read`)
- `GET /attendance` (`admin`, `faculty`, `reports:read`)
- `GET /academic-performance` (`admin`, `faculty`, `reports:read`)
- `GET /fees` (`admin`, `reports:read`)
- `GET /grievances` (`admin`, `reports:read`)

### Audit Logs (`/api/v1/audit-logs`)
- `GET /`, `GET /:id` (`admin`, `audit_logs:read`)

### System Settings (`/api/v1/settings`)
- `GET /public` (Authenticated) — Public institutional configuration merged with `SYSTEM_DEFAULTS`
- `GET /`, `GET /:key`, `POST /`, `PUT /:key` (`admin`, `settings:manage`) — Typed institutional setting management

