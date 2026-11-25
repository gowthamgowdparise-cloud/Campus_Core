'use strict';

const mongoose = require('mongoose');
const logger   = require('../utils/logger');
const { config } = require('./index');

const READY_STATE_LABELS = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
};

/** Mongoose connection options */
const MONGOOSE_OPTIONS = {
  serverSelectionTimeoutMS : 5000,
  socketTimeoutMS          : 45000,
  maxPoolSize              : 10,
  minPoolSize              : 2,
  heartbeatFrequencyMS     : 10000,
};

let connectionPromise = null;

/**
 * Resolve the target MongoDB URI for the current environment.
 * Test runs prefer MONGODB_URI_TEST so production/dev data stays isolated.
 */
const getDatabaseUri = (uriOverride = null) => {
  if (uriOverride) return uriOverride;
  return config.db.activeUri;
};

/**
 * Establish a Mongoose connection to MongoDB.
 * Uses mongoose.connection.readyState and coalesces concurrent calls.
 */
const connectDB = async (uriOverride = null) => {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  const uri = getDatabaseUri(uriOverride);
  if (!uri) {
    throw new Error('MongoDB connection URI is not defined in environment variables');
  }

  connectionPromise = (async () => {
    try {
      await mongoose.connect(uri, MONGOOSE_OPTIONS);
      logger.info(`MongoDB connected: ${mongoose.connection.host}/${mongoose.connection.name}`);
      return mongoose.connection;
    } catch (err) {
      logger.error(`MongoDB connection failed (${err.name}): ${err.message}`);
      throw err;
    } finally {
      connectionPromise = null;
    }
  })();

  return connectionPromise;
};

/**
 * Gracefully close the Mongoose connection if active or connecting.
 */
const disconnectDB = async () => {
  if (connectionPromise) {
    await connectionPromise.catch(() => {});
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
    logger.info('MongoDB connection closed');
  }
};

/**
 * Return current MongoDB connection health metadata (no credentials exposed).
 */
const getDBStatus = () => {
  const { readyState } = mongoose.connection;
  return {
    readyState,
    status: READY_STATE_LABELS[readyState] || 'unknown',
    isConnected: readyState === 1,
    database: readyState === 1 ? mongoose.connection.name : null,
  };
};

/** Mongoose event listeners */
mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB disconnected');
});

mongoose.connection.on('error', (err) => {
  logger.error(`MongoDB error (${err.name}): ${err.message}`);
});

mongoose.connection.on('reconnected', () => {
  logger.info('MongoDB reconnected');
});

module.exports = { connectDB, disconnectDB, getDBStatus, getDatabaseUri, MONGOOSE_OPTIONS };
