'use strict';

/**
 * Secure Admin Provisioning Script
 * ─────────────────────────────────
 * Run ONCE to create the initial administrator account.
 * Values are read from environment variables – never hardcoded.
 *
 * Usage:
 *   npm run seed:admin
 *
 * Required env vars:
 *   INITIAL_ADMIN_EMAIL
 *   INITIAL_ADMIN_PASSWORD
 *   INITIAL_ADMIN_NAME
 */

require('dotenv').config();

const User = require('../modules/users/user.model');
const { connectDB, disconnectDB } = require('../config/database');
const logger = require('../utils/logger');

const seed = async () => {
  const email    = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  const name     = (process.env.INITIAL_ADMIN_NAME || 'System Administrator').trim();

  if (!email || !password) {
    logger.error('INITIAL_ADMIN_EMAIL and INITIAL_ADMIN_PASSWORD must be set in .env');
    process.exit(1);
  }

  if (!/^\S+@\S+\.\S+$/.test(email)) {
    logger.error('INITIAL_ADMIN_EMAIL must be a valid email address');
    process.exit(1);
  }

  // Password complexity check
  const strong = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{8,}$/.test(password);
  if (!strong) {
    logger.error('INITIAL_ADMIN_PASSWORD is too weak. It must have uppercase, lowercase, digit, and special character, min 8 chars.');
    process.exit(1);
  }

  await connectDB();

  try {
    const existing = await User.findOne({
      $or: [{ email }, { role: 'admin' }],
    }).setOptions({ includeDeleted: true });

    if (existing) {
      logger.warn('An administrator account or matching email already exists. No changes made.');
      return;
    }

    const [firstName, ...rest] = name.split(/\s+/);
    const lastName = rest.join(' ') || 'Administrator';

    await User.create({
      firstName,
      lastName,
      email,
      role              : 'admin',
      status            : 'active',
      passwordHash      : password, // pre-save hook hashes this
      mustChangePassword: false,
    });

    logger.info(`Admin account created: ${email}`);
    logger.info('Remove INITIAL_ADMIN_* vars from .env after first run.');
  } finally {
    await disconnectDB();
  }
};

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    logger.error(`Seed failed: ${err.message}`);
    process.exit(1);
  });
