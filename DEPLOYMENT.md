# CAMPUSCORE — Deployment & Operations Guide (Render + MongoDB Atlas)

> Deployment guide for the CAMPUSCORE **backend-only** Node.js / Express REST API. Do not deploy without completing the pre-flight checklist and external credential setup below.

---

## 1. MongoDB Atlas Setup (Required for ACID Transactions)

CAMPUSCORE relies on multi-document ACID transactions (`runInTransaction` in [`src/utils/transaction.js`](src/utils/transaction.js)) for student admissions, faculty onboarding, HOD/class-teacher updates, bulk enrollments, attendance/marks correction approvals, result generation/publication, and fee/payment updates.

1. Create a **MongoDB Atlas** cluster (M0 Free or Dedicated tier — all Atlas clusters run as replica sets supporting multi-document transactions).
2. Under **Database Access**, create a dedicated database user with read/write privileges limited to the `campuscore` database (and a separate user or isolated `campuscore_test` database for automated testing).
3. Under **Network Access**, add Render's outbound IP addresses (or tighten to VPC/peering on paid tiers).
4. Copy the SRV connection string into `MONGODB_URI` (**never** hardcode credentials in code or commit `.env`):
   ```
   mongodb+srv://<username>:<password>@<cluster>.mongodb.net/campuscore?retryWrites=true&w=majority
   ```

### Local Development Replica Set (Transactions on Local `mongod`)
An uninitialized standalone local `mongod` instance **cannot** execute multi-document transactions (`runInTransaction` will throw a MongoDB replica-set error). For local offline development without Atlas, configure a single-node replica set:

```bash
mongod --replSet rs0 --dbpath ./data/db
# In another shell:
mongosh --eval "rs.initiate()"
```
Or point `MONGODB_URI` and `MONGODB_URI_TEST` to two separate databases on MongoDB Atlas (`campuscore` and `campuscore_test`).

---

## 2. File Storage in Production (S3 / S3-Compatible)

- Render's local container filesystem is **ephemeral** and wiped across restarts/redeploys.
- Therefore `LocalStorageProvider` is **blocked by default when `NODE_ENV=production`** (`ALLOW_LOCAL_STORAGE_IN_PROD=false`).
- Configure **AWS S3** or an S3-compatible provider (Cloudflare R2, MinIO, DigitalOcean Spaces) in production:
  - `STORAGE_PROVIDER=s3`
  - `S3_BUCKET=<private-bucket-name>`
  - `S3_REGION=<region>`
  - `S3_ENDPOINT=<optional-for-R2-or-Spaces>`
  - `S3_ACCESS_KEY_ID=<key>`
  - `S3_SECRET_ACCESS_KEY=<secret>`
  - `STORAGE_SIGNED_URL_TTL_SECONDS=300`

---

## 3. Payment Provider Setup (Optional External Gateway)

By default (`PAYMENT_PROVIDER=manual`), CAMPUSCORE supports manual/reference payment submissions, official receipts, idempotency keys, and admin reconciliation. To enable online gateway initiation and webhooks:

- **Razorpay**: set `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`; point Razorpay webhooks to `https://<your-render-domain>/api/v1/payments/webhooks/razorpay`.
- **Stripe**: set `PAYMENT_PROVIDER=stripe`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`; point Stripe webhooks to `https://<your-render-domain>/api/v1/payments/webhooks/stripe`.

---

## 4. Render Deployment Instructions

[`render.yaml`](render.yaml) is included as a Render Blueprint specification:

1. Push your repository to your own private/controlled GitHub account (see Git commands below; never push `.env`).
2. Log in to **Render Dashboard** → **New +** → **Web Service** (or **Blueprint** referencing `render.yaml`).
3. Configure service settings:
   - **Runtime**: Node (`>= 18.0.0`, tested on Node 26)
   - **Build Command**: `npm ci`
   - **Start Command**: `npm start` (`node src/server.js`)
   - **Health Check Path**: `/health/ready`
4. Add **Environment Variables** securely in the Render Dashboard (**never in Git**):
   - `NODE_ENV=production`
   - `MONGODB_URI=<your Atlas URI>`
   - `JWT_ACCESS_SECRET=<64+ random hex chars>`
   - `JWT_REFRESH_SECRET=<different 64+ random hex chars>`
   - `ALLOWED_ORIGINS=https://<your-frontend-domain>` *(Critical: empty `ALLOWED_ORIGINS` rejects cross-origin browser requests in production)*
   - `STORAGE_PROVIDER=s3` + S3 credentials
   - Optional Razorpay / Stripe credentials if using external gateway flows
5. Run one-time initial admin provisioning from a secure one-off Render shell (setting `INITIAL_ADMIN_*` temporarily, running `npm run seed:admin`, and then removing `INITIAL_ADMIN_PASSWORD` from env).

### Render Plan Caveats
- **Render Free Tier**: Web services on the free plan spin down after ~15 minutes of inactivity, causing cold-start latency (15–50s on the next request), and have limited ephemeral disk and no persistent outbound static IPs. Use a paid Render tier for production institutional workloads.

---

## 5. Post-Deployment Verification & Troubleshooting

- Verify liveness: `GET https://<render-url>/health/live` → `200 { "status": "ok" }`
- Verify DB readiness: `GET https://<render-url>/health/ready` → `200 { "status": "ok", "database": { "isConnected": true } }` (omits DB name/internals in production)
- Verify API Docs: `GET https://<render-url>/api/v1/docs.json` (and `/api/v1/docs`)
- **Common Issues**:
  - `503` on `/health/ready`: Verify Atlas IP allowlist and `MONGODB_URI` credentials.
  - `403 CORS: origin ... not allowed`: Add the exact frontend scheme + host (no trailing slash) to `ALLOWED_ORIGINS`.
  - `503 Local filesystem storage is disabled in production`: Set `STORAGE_PROVIDER=s3` and configure S3 variables.
  - `500` startup failure (`Missing required environment variables`): Ensure `MONGODB_URI`, `JWT_ACCESS_SECRET` (>= 32 chars in prod), and `JWT_REFRESH_SECRET` (>= 32 chars, distinct) are set in Render Environment.

