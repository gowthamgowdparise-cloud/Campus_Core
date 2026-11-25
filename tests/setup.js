'use strict';

/**
 * Jest global test setup.
 * Loads .env first so MONGODB_URI_TEST is available, verifies strict DB isolation
 * before setting fallback test defaults, and isolates runtime variables.
 */
require('dotenv').config();

if (
  process.env.MONGODB_URI &&
  process.env.MONGODB_URI_TEST &&
  process.env.MONGODB_URI.trim() === process.env.MONGODB_URI_TEST.trim()
) {
  throw new Error('MONGODB_URI_TEST must be distinct from MONGODB_URI to prevent running tests against production data');
}

process.env.NODE_ENV = 'test';
process.env.MONGODB_URI_TEST = process.env.MONGODB_URI_TEST || 'mongodb://localhost:27017/campuscore_test';
process.env.MONGODB_URI = process.env.MONGODB_URI_TEST;
process.env.JWT_ACCESS_SECRET = 'test-access-secret-must-be-at-least-32-chars-long!';
process.env.JWT_REFRESH_SECRET = 'test-refresh-secret-must-be-different-from-access!';
process.env.JWT_ACCESS_EXPIRES_IN = '15m';
process.env.JWT_REFRESH_EXPIRES_IN = '7d';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.PORT = '5001';
process.env.LOG_LEVEL = 'silent';
process.env.RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.AUTH_RATE_LIMIT_MAX_REQUESTS = '1000';
process.env.ALLOWED_ORIGINS = 'http://localhost:3000';
process.env.STORAGE_PROVIDER = 'local';
process.env.STORAGE_LOCAL_DIR = 'uploads-test';
