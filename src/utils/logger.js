'use strict';

const winston = require('winston');
const DailyRotateFile = require('winston-daily-rotate-file');
const path  = require('path');
const fs    = require('fs');

const LOG_DIR = process.env.LOG_DIR || 'logs';
const IS_SILENT = process.env.LOG_LEVEL === 'silent' || process.env.NODE_ENV === 'test';

if (!IS_SILENT && !fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

const SENSITIVE_KEY_PATTERN = /(password|pass|token|secret|authorization|cookie|cvv|cardnumber|pin|privatekey|apikey|signature)/i;

/**
 * Redact secrets, tokens, credentials in MongoDB URIs, and bearer strings before logging.
 */
const redactValue = (val, depth = 0) => {
  if (depth > 5 || val === null || val === undefined) return val;
  if (typeof val === 'string') {
    return val
      .replace(/(mongodb(?:\+srv)?:\/\/[^:\s]+:)([^@\s]+)(@)/gi, '$1[REDACTED]$3')
      .replace(/(Bearer\s+)[A-Za-z0-9._-]+/gi, '$1[REDACTED]');
  }
  if (Array.isArray(val)) {
    return val.map((item) => redactValue(item, depth + 1));
  }
  if (typeof val === 'object') {
    const cleaned = {};
    for (const [k, v] of Object.entries(val)) {
      cleaned[k] = SENSITIVE_KEY_PATTERN.test(k) ? '[REDACTED]' : redactValue(v, depth + 1);
    }
    return cleaned;
  }
  return val;
};

const redactSecrets = winston.format((info) => {
  const cleaned = redactValue(info);
  // Preserve Winston/logform internal Symbol metadata (e.g. Symbol(level), Symbol(splat))
  for (const sym of Object.getOwnPropertySymbols(info)) {
    cleaned[sym] = info[sym];
  }
  return cleaned;
});

const { combine, timestamp, printf, colorize, errors, json } = winston.format;

/** Console format: colorised, human-readable */
const consoleFormat = combine(
  redactSecrets(),
  colorize({ all: true }),
  timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  errors({ stack: true }),
  printf(({ level, message, timestamp: ts, stack, requestId }) => {
    const reqTag = requestId ? ` [${requestId}]` : '';
    return stack
      ? `[${ts}]${reqTag} ${level}: ${message}\n${stack}`
      : `[${ts}]${reqTag} ${level}: ${message}`;
  })
);

/** File format: structured JSON */
const fileFormat = combine(
  redactSecrets(),
  timestamp(),
  errors({ stack: true }),
  json()
);

const transports = [
  new winston.transports.Console({ format: consoleFormat, silent: IS_SILENT }),
];

if (!IS_SILENT) {
  transports.push(
    new DailyRotateFile({
      filename     : path.join(LOG_DIR, 'error-%DATE%.log'),
      datePattern  : 'YYYY-MM-DD',
      level        : 'error',
      format       : fileFormat,
      maxFiles     : '30d',
      zippedArchive: true,
    }),
    new DailyRotateFile({
      filename     : path.join(LOG_DIR, 'combined-%DATE%.log'),
      datePattern  : 'YYYY-MM-DD',
      format       : fileFormat,
      maxFiles     : '14d',
      zippedArchive: true,
    })
  );
}

const resolvedLevel = process.env.LOG_LEVEL && process.env.LOG_LEVEL !== 'silent'
  ? process.env.LOG_LEVEL
  : 'http';

const logger = winston.createLogger({
  level      : resolvedLevel,
  silent     : IS_SILENT,
  transports,
  exitOnError: false,
});

logger.redactValue = redactValue;

module.exports = logger;
