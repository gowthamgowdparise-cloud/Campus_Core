'use strict';

const { config } = require('../../config');
const AppError   = require('../../utils/AppError');
const { LocalStorageProvider } = require('./localStorage.provider');
const { S3StorageProvider }    = require('./s3Storage.provider');

const localProvider = new LocalStorageProvider();
const s3Provider    = new S3StorageProvider();

/**
 * Resolve active storage provider from STORAGE_PROVIDER environment variable.
 * @param {string} [overrideName]
 */
const getStorageProvider = (overrideName = null) => {
  const name = (overrideName || config.storage.provider || 'local').toLowerCase();
  if (name === 's3') return s3Provider;
  if (name === 'local') return localProvider;
  throw new AppError(`Unsupported storage provider "${name}"`, 500);
};

module.exports = {
  getStorageProvider,
  localProvider,
  s3Provider,
};

