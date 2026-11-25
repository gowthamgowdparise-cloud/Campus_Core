'use strict';

const express       = require('express');
const helmet        = require('helmet');
const cors          = require('cors');
const compression   = require('compression');
const cookieParser  = require('cookie-parser');
const mongoSanitize = require('express-mongo-sanitize');

const { config }     = require('./config');
const AppError       = require('./utils/AppError');
const requestId      = require('./middleware/requestId');
const requestLogger  = require('./middleware/requestLogger');
const apiRateLimit   = require('./middleware/rateLimiter');
const { errorHandler, notFound } = require('./middleware/errorHandler');
const routes         = require('./routes');

const app = express();
app.disable('x-powered-by');

// ── Trust proxy (for accurate IPs behind Render / reverse proxies) ──
app.set('trust proxy', 1);

// ── Request correlation ID (earliest middleware) ───────────
app.use(requestId);

// ── Security headers ─────────────────────────────────────────
const helmetApiMiddleware = helmet({
  contentSecurityPolicy     : config.app.env === 'production'
    ? {
        directives: {
          defaultSrc: ["'none'"],
          frameAncestors: ["'none'"],
        },
      }
    : false,
  crossOriginResourcePolicy : { policy: 'same-origin' },
  referrerPolicy            : { policy: 'no-referrer' },
  hsts                      : config.app.env === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false,
});

// Swagger UI docs require inline script/style CSP permissions scoped ONLY to /api/*/docs
const helmetDocsMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc : ["'self'", "'unsafe-inline'"],
      styleSrc  : ["'self'", "'unsafe-inline'"],
      imgSrc    : ["'self'", 'data:'],
    },
  },
  crossOriginResourcePolicy: { policy: 'same-origin' },
  referrerPolicy           : { policy: 'no-referrer' },
});

app.use((req, res, next) => {
  if (req.path.includes('/docs')) {
    return helmetDocsMiddleware(req, res, next);
  }
  return helmetApiMiddleware(req, res, next);
});

// ── CORS (fail-closed in production when ALLOWED_ORIGINS is empty) ──
const corsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser / server-to-server requests with no Origin header
    if (!origin) return callback(null, true);
    if (config.cors.allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    if (config.app.env !== 'production' && config.cors.allowedOrigins.length === 0) {
      return callback(null, true);
    }
    return callback(new AppError(`CORS: origin ${origin} not allowed`, 403));
  },
  credentials   : true,
  methods       : ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id', 'Idempotency-Key'],
  exposedHeaders: ['X-Request-Id'],
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ── Body parsing (capture rawBody exclusively for payment webhooks) ──
app.use(express.json({
  limit : config.http.jsonLimit,
  verify: (req, _res, buf) => {
    if (req.originalUrl && req.originalUrl.includes('/payments/webhooks/')) {
      req.rawBody = buf;
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: config.http.jsonLimit }));
app.use(cookieParser());

// ── Compression ───────────────────────────────────────────────
app.use(compression());

// ── MongoDB query injection sanitization ─────────────────────
app.use(mongoSanitize());

// ── Request logging ───────────────────────────────────────────
app.use(requestLogger);

// ── API Rate limiting ─────────────────────────────────────────
app.use(`/api/${config.app.version}`, apiRateLimit);

// ── Mount centralised routes (health + /api/v1/*) ────────────
app.use(routes);

// ── 404 handler ───────────────────────────────────────────────
app.use(notFound);

// ── Global error handler (must be last) ──────────────────────
app.use(errorHandler);

module.exports = app;
