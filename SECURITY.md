# CAMPUSCORE — Security Architecture & Review Guide

> Overview of implemented security controls, audit logging, upload/payment defenses, and remaining pre-production external reviews.

---

## 1. Authentication & Session Controls
- **Password Hashing**: `bcryptjs` with configurable work factor (`BCRYPT_SALT_ROUNDS`, default `12`, minimum `10` enforced in production by `validateConfig()`).
- **JWT Isolation**: Separate `JWT_ACCESS_SECRET` (short-lived, default `15m`) and `JWT_REFRESH_SECRET` (default `7d`, validated distinct and >= 32 chars in production). Token `type` (`'access'` vs `'refresh'`) is strictly validated.
- **Session Revocation & Rotation**:
  - Refresh tokens are stored in MongoDB as **SHA-256 digests** (`user.refreshTokens`, max 5 devices) with `uuid` v4 token families.
  - Refreshing rotates the token; reusing a previously rotated/revoked token triggers **reuse detection** (revoking the entire family and persisting `REFRESH_TOKEN_REUSE_DETECTED` in `AuditLog`).
  - Password change, `logout-all`, user role change, or user deactivation/suspension increments `tokenVersion` / updates `passwordChangedAt`, immediately invalidating prior access & refresh tokens.
- **Account Status**: `suspended`, `inactive`, and `pending_verification` users are denied login and protected API access after password verification.
- **Admin Seed**: `npm run seed:admin` enforces password complexity and rejects duplicate/overwriting admin provisioning; credentials come solely from environment variables.

## 2. Authorization, RBAC, Permissions & Anti-IDOR
- Caller identity (`req.user.id`, `req.user.role`, `req.user.permissions`) is derived solely from verified JWT + active MongoDB `User` record (client-supplied `role` or `user` fields in request bodies are ignored or rejected).
- Middleware layers in [`src/middleware/authorize.js`](src/middleware/authorize.js): `authorize`, `requirePermission`, `requireAnyPermission`, `requireOwnerOrAdmin`.
- Service-layer IDOR & scope guards:
  - **Students**: Restricted to own profiles, enrollments, attendance, marks, published results, fee records, payments, private documents, notifications, and grievances (`isInternal` staff comments stripped). Self-update routes strip protected fields (`cgpa`, `rollNumber`, `program`, `status`).
  - **Faculty**: Scoped strictly via active `CourseAssignment` and `Section.classTeacher` links for viewing students, marking attendance, uploading course materials, entering marks, and reviewing attendance corrections. Cannot approve marks, publish results, or post global announcements.
  - **Admin**: Explicitly permission-guarded for master data, marks approval, result generation/publication, payment reconciliation, system settings, and audit logs.

## 3. API, Transport & Input Security
- **Helmet**: Sets `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `Cross-Origin-Resource-Policy: same-origin`, HSTS in production, strict `default-src 'none'` CSP on API routes, and isolated Swagger CSP solely on `/api/*/docs*`. `x-powered-by` disabled.
- **CORS**: Allowlist via `ALLOWED_ORIGINS`. In `NODE_ENV=production`, empty `ALLOWED_ORIGINS` **fails closed** (blocks cross-origin browser requests with `403`).
- **Rate Limiting**: General API limit (`100` / 15 min) + strict auth endpoint limit (`10` / 15 min); health probes and signed webhooks excluded cleanly.
- **Validation & Sanitization**: Joi schemas with `stripUnknown: true`, `allowUnknown: false`; `express-mongo-sanitize` strips `$`/`.` operators; `escapeRegex` protects search queries from ReDoS; ObjectId path parameters validated cleanly.
- **Payloads & Timeouts**: JSON bodies capped (`JSON_BODY_LIMIT=1mb`); raw webhook buffer captured ONLY on `/api/*/payments/webhooks/*`; server enforces `requestTimeout`, `keepAliveTimeout`, and `headersTimeout`.
- **Production Error Handling & Log Redaction**: Stack traces and non-operational 500 messages are suppressed in `production`; Winston `redactSecrets` format strips passwords, tokens, secret keys, CVVs, card numbers, Bearer headers, and MongoDB URI credentials from logs.

## 4. File Upload & Storage Security
- Uploads validated via `multer` `memoryStorage` + [`src/middleware/upload.js`](src/middleware/upload.js) enforcing size limits (`MAX_FILE_SIZE_MB`), extension & MIME allowlists (`.pdf`, `.png`, `.jpg`, `.jpeg`, `.webp`, `.docx`, `.pptx`, `.xlsx`, `.txt`; SVG/HTML/executables blocked), and **magic-byte signature checks**.
- Files saved using server-controlled UUID `storageKey`s (`documents/<userId>/<uuid>.<ext>`), rejecting `..` and path-traversal attempts.
- Production disables local filesystem storage (`STORAGE_PROVIDER=s3` recommended with private bucket ACL and short-lived presigned URLs). Downloads set `X-Content-Type-Options: nosniff` & `Content-Disposition: attachment` and are audited.

## 5. Payment & Audit Log Security
- **Zero Card Credential Storage**: `Payment` never stores card numbers, CVVs, or banking secrets; Joi strips unknown fields.
- **Trusted Status Transitions**: Students cannot self-mark payments as `success`, `verified`, or `reconciled`; online settlement occurs only via admin reconciliation or HMAC-SHA256 verified provider checkout/webhook verification with unique `webhookEventId` idempotency.
- **Immutable Audit Logs**: `AuditLog` schema hooks reject updates and ordinary deletes (`403`), and `/api/v1/audit-logs` is read-only for `admin`.

## 6. Remaining Pre-Production Reviews (Required Before Live Launch)
1. **Institutional Policy Sign-off**: Confirm attendance thresholds, late rules, grading scales, credit limits, and late fee rates in `SystemSetting` with university governance (fallback constants in `src/config/systemDefaults.js` are generic defaults, not institutional policy).
2. **External Storage & Gateway Verification**: Provision private AWS S3 / R2 credentials and sandbox/live Razorpay or Stripe webhook secrets and verify end-to-end in staging.
3. **Independent Security & Legal/Privacy Review**: Conduct external penetration testing and institutional data-privacy / retention review (FERPA / DPDP compliance) prior to onboarding real student records.

