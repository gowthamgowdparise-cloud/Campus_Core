'use strict';

/**
 * Centralised application configuration.
 * Dynamic getters ensure values stay in sync if dotenv or test setup updates process.env.
 */
const PLACEHOLDER_REGEX = /^(REPLACE_WITH_|YOUR_|CHANGEME)/i;

const config = {
  app: {
    get env()     { return process.env.NODE_ENV || 'development'; },
    get port()    { return parseInt(process.env.PORT || '5000', 10); },
    get version() { return process.env.API_VERSION || 'v1'; },
  },

  db: {
    get uri()     { return process.env.MONGODB_URI; },
    get uriTest() { return process.env.MONGODB_URI_TEST; },
    get activeUri() {
      // Strict isolation: tests MUST use MONGODB_URI_TEST and never fall back to production MONGODB_URI
      return process.env.NODE_ENV === 'test'
        ? process.env.MONGODB_URI_TEST
        : process.env.MONGODB_URI;
    },
  },

  jwt: {
    get accessSecret()     { return process.env.JWT_ACCESS_SECRET; },
    get refreshSecret()    { return process.env.JWT_REFRESH_SECRET; },
    get accessExpiresIn()  { return process.env.JWT_ACCESS_EXPIRES_IN  || '15m'; },
    get refreshExpiresIn() { return process.env.JWT_REFRESH_EXPIRES_IN || '7d'; },
  },

  bcrypt: {
    get saltRounds() { return parseInt(process.env.BCRYPT_SALT_ROUNDS || '12', 10); },
  },

  rateLimit: {
    get windowMs()   { return parseInt(process.env.RATE_LIMIT_WINDOW_MS       || '900000', 10); },
    get max()        { return parseInt(process.env.RATE_LIMIT_MAX_REQUESTS     || '100', 10); },
    get authWindow() { return parseInt(process.env.AUTH_RATE_LIMIT_WINDOW_MS   || '900000', 10); },
    get authMax()    { return parseInt(process.env.AUTH_RATE_LIMIT_MAX_REQUESTS || '10', 10); },
  },

  cors: {
    get allowedOrigins() {
      return (process.env.ALLOWED_ORIGINS || '')
        .split(',')
        .map((o) => o.trim())
        .filter(Boolean);
    },
  },

  http: {
    get jsonLimit()        { return process.env.JSON_BODY_LIMIT || '1mb'; },
    get requestTimeoutMs() { return parseInt(process.env.HTTP_REQUEST_TIMEOUT_MS || '30000', 10); },
  },

  storage: {
    get provider()          { return (process.env.STORAGE_PROVIDER || 'local').toLowerCase(); },
    get localDir()          { return process.env.STORAGE_LOCAL_DIR || 'uploads'; },
    get maxFileSizeMb()     { return parseInt(process.env.MAX_FILE_SIZE_MB || '10', 10); },
    get signedUrlTtlSec()   { return parseInt(process.env.STORAGE_SIGNED_URL_TTL_SECONDS || '300', 10); },
    get s3Bucket()          { return process.env.S3_BUCKET || ''; },
    get s3Region()          { return process.env.S3_REGION || ''; },
    get s3Endpoint()        { return process.env.S3_ENDPOINT || ''; },
    get s3AccessKeyId()     { return process.env.S3_ACCESS_KEY_ID || ''; },
    get s3SecretAccessKey() { return process.env.S3_SECRET_ACCESS_KEY || ''; },
    get s3ForcePathStyle()  { return process.env.S3_FORCE_PATH_STYLE === 'true'; },
  },

  payments: {
    get provider()              { return (process.env.PAYMENT_PROVIDER || 'manual').toLowerCase(); },
    get currency()              { return (process.env.PAYMENT_CURRENCY || 'INR').toUpperCase(); },
    get razorpayKeyId()         { return process.env.RAZORPAY_KEY_ID || ''; },
    get razorpayKeySecret()     { return process.env.RAZORPAY_KEY_SECRET || ''; },
    get razorpayWebhookSecret() { return process.env.RAZORPAY_WEBHOOK_SECRET || ''; },
    get stripeSecretKey()       { return process.env.STRIPE_SECRET_KEY || ''; },
    get stripeWebhookSecret()   { return process.env.STRIPE_WEBHOOK_SECRET || ''; },
  },

  logging: {
    get level() { return process.env.LOG_LEVEL || 'http'; },
    get dir()   { return process.env.LOG_DIR   || 'logs'; },
  },
};

/**
 * Validate critical configuration at startup.
 * Throws if mandatory values are missing or invalid so the server fails fast.
 */
const validateConfig = () => {
  const required = [
    ['db.activeUri',        config.db.activeUri],
    ['jwt.accessSecret',    config.jwt.accessSecret],
    ['jwt.refreshSecret',   config.jwt.refreshSecret],
  ];

  const missing = required.filter(([, value]) => !value).map(([key]) => key);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  if (config.jwt.accessSecret === config.jwt.refreshSecret) {
    throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
  }

  if (
    PLACEHOLDER_REGEX.test(config.jwt.accessSecret) ||
    PLACEHOLDER_REGEX.test(config.jwt.refreshSecret)
  ) {
    throw new Error('JWT secrets must not use placeholder values');
  }

  if (config.app.env === 'production') {
    if (config.jwt.accessSecret.length < 32 || config.jwt.refreshSecret.length < 32) {
      throw new Error('JWT secrets must be at least 32 characters in production');
    }
    if (config.bcrypt.saltRounds < 10) {
      throw new Error('BCRYPT_SALT_ROUNDS must be at least 10 in production');
    }
  }

  if (!Number.isInteger(config.app.port) || config.app.port <= 0 || config.app.port > 65535) {
    throw new Error('PORT must be a valid TCP port number (1-65535)');
  }

  if (!Number.isInteger(config.bcrypt.saltRounds) || config.bcrypt.saltRounds < 4) {
    throw new Error('BCRYPT_SALT_ROUNDS must be an integer >= 4');
  }
};

module.exports = { config, validateConfig };
