'use strict';

const fs   = require('fs');
const path = require('path');
const { config } = require('../../config');
const AppError   = require('../../utils/AppError');

const ensureWithinRoot = (rootDir, storageKey) => {
  if (!storageKey || typeof storageKey !== 'string') {
    throw new AppError('Invalid storage key', 400);
  }
  const normalizedKey = storageKey.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedKey.includes('..') || normalizedKey.includes('\0')) {
    throw new AppError('Invalid storage key (path traversal rejected)', 400);
  }
  const resolvedRoot = path.resolve(rootDir);
  const resolvedPath = path.resolve(resolvedRoot, normalizedKey);
  if (!resolvedPath.startsWith(resolvedRoot + path.sep)) {
    throw new AppError('Invalid storage path boundary', 400);
  }
  return { resolvedRoot, resolvedPath, normalizedKey };
};

class LocalStorageProvider {
  constructor() {
    this.providerName = 'local';
  }

  getRootDir() {
    if (config.app.env === 'production' && process.env.ALLOW_LOCAL_STORAGE_IN_PROD !== 'true') {
      throw new AppError(
        'Local filesystem storage is disabled in production (Render filesystems are ephemeral). Configure S3 storage instead.',
        503
      );
    }
    return path.resolve(process.cwd(), config.storage.localDir);
  }

  async putObject({ key, buffer }) {
    const { resolvedPath, normalizedKey } = ensureWithinRoot(this.getRootDir(), key);
    await fs.promises.mkdir(path.dirname(resolvedPath), { recursive: true });
    await fs.promises.writeFile(resolvedPath, buffer, { flag: 'wx' });
    return {
      provider: this.providerName,
      key     : normalizedKey,
      location: normalizedKey,
    };
  }

  async getObjectStream(key) {
    const { resolvedPath } = ensureWithinRoot(this.getRootDir(), key);
    try {
      await fs.promises.access(resolvedPath, fs.constants.R_OK);
    } catch {
      throw new AppError('Stored file could not be located on storage backend', 404);
    }
    return {
      mode  : 'stream',
      stream: fs.createReadStream(resolvedPath),
    };
  }

  async deleteObject(key) {
    if (!key) return;
    const { resolvedPath } = ensureWithinRoot(this.getRootDir(), key);
    await fs.promises.unlink(resolvedPath).catch((err) => {
      if (err.code !== 'ENOENT') throw err;
    });
  }
}

module.exports = { LocalStorageProvider, ensureWithinRoot };

