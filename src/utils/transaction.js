'use strict';

const mongoose = require('mongoose');
const logger   = require('./logger');

/**
 * Default transaction options aligned with MongoDB Atlas replica sets.
 */
const DEFAULT_TX_OPTIONS = {
  readPreference: 'primary',
  readConcern   : { level: 'local' },
  writeConcern  : { w: 'majority' },
};

/**
 * Execute an asynchronous unit of work inside a MongoDB ACID transaction.
 * Automatically manages session lifecycle, commits on success, aborts on failure,
 * and ensures session cleanup.
 *
 * Usage:
 *   const result = await runInTransaction(async (session) => {
 *     await User.create([userData], { session });
 *     await Student.create([studentData], { session });
 *     return student;
 *   });
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession) => Promise<T>} workFn
 * @param {object} [txOptions]
 * @returns {Promise<T>}
 */
const runInTransaction = async (workFn, txOptions = DEFAULT_TX_OPTIONS) => {
  if (typeof workFn !== 'function') {
    throw new TypeError('runInTransaction requires a work function');
  }

  const session = await mongoose.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      result = await workFn(session);
    }, txOptions);
    return result;
  } catch (err) {
    logger.error(`MongoDB transaction failed (${err.name}): ${err.message}`);
    throw err;
  } finally {
    await session.endSession();
  }
};

module.exports = { runInTransaction, DEFAULT_TX_OPTIONS };

