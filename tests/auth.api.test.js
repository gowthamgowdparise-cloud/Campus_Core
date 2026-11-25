'use strict';

require('./setup');

const request  = require('supertest');
const mongoose = require('mongoose');
const app      = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/database');
const User     = require('../src/modules/users/user.model');

describe('Core API & Validation (No DB Required)', () => {
  beforeAll(async () => {
    await disconnectDB();
  });

  test('GET /health returns 503 degraded when MongoDB is disconnected', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.database.status).toBe('disconnected');
  });

  test('POST /api/v1/auth/login returns 422 for invalid request body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'not-an-email', password: '' });
    expect(res.statusCode).toBe(422);
    expect(res.body).toHaveProperty('details');
  });

  test('POST /api/v1/auth/refresh returns 401 when no token is provided in cookie or body', async () => {
    const res = await request(app).post('/api/v1/auth/refresh').send({});
    expect(res.statusCode).toBe(401);
  });

  test('POST /api/v1/auth/login returns 400 for malformed JSON body', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"brokenJson": ');
    expect(res.statusCode).toBe(400);
  });

  test('GET /api/v1/reports requires authentication', async () => {
    const res = await request(app).get('/api/v1/reports');
    expect(res.statusCode).toBe(401);
  });

  test('GET /api/v1/does-not-exist-xyz returns 404', async () => {
    const res = await request(app).get('/api/v1/does-not-exist-xyz');
    expect(res.statusCode).toBe(404);
  });
});

describe('Auth API Endpoints (MongoDB Integration)', () => {
  const TEST_PASSWORD = 'Test@1234!';
  const ADMIN_EMAIL   = 'admin.auth.test@campuscore.edu';
  const PENDING_EMAIL = 'pending.auth.test@campuscore.edu';

  beforeAll(async () => {
    await connectDB();
    await User.deleteMany({ email: { $in: [ADMIN_EMAIL, PENDING_EMAIL] } }).setOptions({ includeDeleted: true });
    await User.create([
      {
        firstName   : 'Admin',
        lastName    : 'Test',
        email       : ADMIN_EMAIL,
        role        : 'admin',
        passwordHash: TEST_PASSWORD,
        status      : 'active',
      },
      {
        firstName   : 'Pending',
        lastName    : 'Student',
        email       : PENDING_EMAIL,
        role        : 'student',
        passwordHash: TEST_PASSWORD,
        status      : 'pending_verification',
      },
    ]);
  }, 15000);

  afterAll(async () => {
    if (mongoose.connection.readyState === 1) {
      await User.deleteMany({ email: { $in: [ADMIN_EMAIL, PENDING_EMAIL] } }).setOptions({ includeDeleted: true });
      await disconnectDB();
    }
  }, 15000);

  test('GET /health returns 200 ok when MongoDB is connected', async () => {
    const res = await request(app).get('/health');
    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body.service).toBe('campuscore-api');
    expect(res.body.database.isConnected).toBe(true);
  });

  test('POST /api/v1/auth/login returns 200 with tokens, cookie, permissions and strips passwordHash', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });

    expect(res.statusCode).toBe(200);
    expect(res.body.status).toBe('success');
    expect(res.body.data).toHaveProperty('accessToken');
    expect(res.body.data.user.email).toBe(ADMIN_EMAIL);
    expect(res.body.data.user.role).toBe('admin');
    expect(Array.isArray(res.body.data.user.permissions)).toBe(true);
    expect(res.headers['set-cookie']?.[0]).toContain('refreshToken=');
    expect(JSON.stringify(res.body)).not.toContain('passwordHash');
  });

  test('POST /api/v1/auth/login blocks pending_verification account with 403', async () => {
    const res = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: PENDING_EMAIL, password: TEST_PASSWORD });
    expect(res.statusCode).toBe(403);
  });

  test('POST /api/v1/auth/login returns 401 with wrong password or unknown email', async () => {
    const badPass = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: 'WrongPass1!' });
    expect(badPass.statusCode).toBe(401);

    const noUser = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'nobody@campuscore.edu', password: 'Any@1234!' });
    expect(noUser.statusCode).toBe(401);
  });

  test('POST /api/v1/auth/refresh rotates tokens via httpOnly cookie and detects reuse', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });

    const originalCookie = loginRes.headers['set-cookie']?.[0];
    expect(originalCookie).toBeTruthy();

    // Rotate with cookie only (empty body)
    const refreshRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);
    expect(refreshRes.statusCode).toBe(200);
    expect(refreshRes.body.data).toHaveProperty('accessToken');

    const rotatedCookie = refreshRes.headers['set-cookie']?.[0];
    expect(rotatedCookie).toBeTruthy();

    // Reuse old cookie -> should fail with 401 and revoke token family
    const reuseRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', originalCookie);
    expect(reuseRes.statusCode).toBe(401);

    // Rotated cookie from revoked family should now also fail
    const postRevokeRes = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', rotatedCookie);
    expect(postRevokeRes.statusCode).toBe(401);
  });

  test('GET /api/v1/auth/me works with valid token and rejects missing/malformed tokens', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });
    const accessToken = loginRes.body.data.accessToken;

    const okRes = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(okRes.statusCode).toBe(200);
    expect(okRes.body.data.email).toBe(ADMIN_EMAIL);

    const noToken = await request(app).get('/api/v1/auth/me');
    expect(noToken.statusCode).toBe(401);

    const badToken = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer bad.token.here');
    expect(badToken.statusCode).toBe(401);
  });

  test('POST /api/v1/auth/logout revokes cookie refresh token', async () => {
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: ADMIN_EMAIL, password: TEST_PASSWORD });

    const { accessToken } = loginRes.body.data;
    const cookie = loginRes.headers['set-cookie']?.[0];

    const logoutRes = await request(app)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`)
      .set('Cookie', cookie);
    expect(logoutRes.statusCode).toBe(200);

    const refreshAfterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', cookie);
    expect(refreshAfterLogout.statusCode).toBe(401);
  });

  test('PATCH /api/v1/auth/change-password updates password and invalidates prior tokens', async () => {
    const tempEmail = `pwchange.${Date.now()}@campuscore.edu`;
    await User.create({
      firstName   : 'PW',
      lastName    : 'User',
      email       : tempEmail,
      role        : 'faculty',
      passwordHash: TEST_PASSWORD,
      status      : 'active',
    });

    try {
      const loginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: tempEmail, password: TEST_PASSWORD });
      const oldAccess = loginRes.body.data.accessToken;
      const oldCookie = loginRes.headers['set-cookie']?.[0];

      const changeRes = await request(app)
        .patch('/api/v1/auth/change-password')
        .set('Authorization', `Bearer ${oldAccess}`)
        .send({
          currentPassword: TEST_PASSWORD,
          newPassword    : 'NewStrong@99!',
          confirmPassword: 'NewStrong@99!',
        });
      expect(changeRes.statusCode).toBe(200);

      // Old access token must be rejected after password change
      const oldMeRes = await request(app)
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${oldAccess}`);
      expect(oldMeRes.statusCode).toBe(401);

      // Old refresh cookie must be revoked
      const oldRefreshRes = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', oldCookie);
      expect(oldRefreshRes.statusCode).toBe(401);

      // New password must log in cleanly
      const reloginRes = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: tempEmail, password: 'NewStrong@99!' });
      expect(reloginRes.statusCode).toBe(200);

      // logout-all revokes all sessions
      const logoutAllRes = await request(app)
        .post('/api/v1/auth/logout-all')
        .set('Authorization', `Bearer ${reloginRes.body.data.accessToken}`);
      expect(logoutAllRes.statusCode).toBe(200);

      const postLogoutAllRefresh = await request(app)
        .post('/api/v1/auth/refresh')
        .set('Cookie', reloginRes.headers['set-cookie']?.[0]);
      expect(postLogoutAllRefresh.statusCode).toBe(401);
    } finally {
      await User.deleteOne({ email: tempEmail }).setOptions({ includeDeleted: true });
    }
  });
});
