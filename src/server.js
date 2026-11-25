'use strict';

// Load env FIRST
require('dotenv').config();

const { config, validateConfig } = require('./config');
const { connectDB, disconnectDB } = require('./config/database');
const logger = require('./utils/logger');
const app    = require('./app');

let server;
let isShuttingDown = false;

/** Startup sequence */
const start = async () => {
  // 1. Validate configuration
  validateConfig();

  // 2. Connect to MongoDB
  await connectDB();

  // 3. Start HTTP server with hardened timeouts
  server = app.listen(config.app.port, () => {
    logger.info(`
╔══════════════════════════════════════════════╗
║          CAMPUSCORE API Server               ║
╠══════════════════════════════════════════════╣
║  Mode    : ${config.app.env.padEnd(33)}║
║  Port    : ${String(config.app.port).padEnd(33)}║
║  API     : /api/${config.app.version.padEnd(28)}║
║  Health  : /health (ready) | /health/live    ║
╚══════════════════════════════════════════════╝`);
  });

  server.requestTimeout   = config.http.requestTimeoutMs;
  server.keepAliveTimeout = 65000;
  server.headersTimeout   = 66000;

  server.on('error', (err) => {
    logger.error(`HTTP server error: ${err.message}`);
    process.exit(1);
  });
};

/** Graceful shutdown */
const shutdown = async (signal, exitCode = 0) => {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received – shutting down gracefully…`);
  if (server) {
    const forceTimer = setTimeout(() => {
      logger.warn('Forced exit after timeout');
      process.exit(1);
    }, 10_000);
    forceTimer.unref();

    server.close(async () => {
      logger.info('HTTP server closed');
      try {
        await disconnectDB();
      } catch (err) {
        logger.error(`Error disconnecting MongoDB during shutdown: ${err.message}`);
        exitCode = 1;
      }
      logger.info('Process exiting');
      process.exit(exitCode);
    });
  } else {
    try {
      await disconnectDB();
    } catch (err) {
      logger.error(`Error disconnecting MongoDB during shutdown: ${err.message}`);
      exitCode = 1;
    }
    process.exit(exitCode);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));
process.on('uncaughtException', (err) => {
  logger.error(`Uncaught exception: ${err.message}\n${err.stack}`);
  shutdown('uncaughtException', 1);
});
process.on('unhandledRejection', (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
  shutdown('unhandledRejection', 1);
});

start().catch((err) => {
  logger.error(`Startup failed: ${err.message}`);
  process.exit(1);
});
