'use strict';

const crypto = require('crypto');
const path   = require('path');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { config } = require('../config');
const AppError   = require('../utils/AppError');

const ALLOWED_FILE_SPECS = Object.freeze({
  '.pdf': {
    mimes: ['application/pdf'],
    match: (buf) => buf.length >= 5 && buf.subarray(0, 5).toString('ascii') === '%PDF-',
  },
  '.png': {
    mimes: ['image/png'],
    match: (buf) => buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])),
  },
  '.jpg': {
    mimes: ['image/jpeg', 'image/pjpeg'],
    match: (buf) => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
  },
  '.jpeg': {
    mimes: ['image/jpeg', 'image/pjpeg'],
    match: (buf) => buf.length >= 3 && buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF,
  },
  '.webp': {
    mimes: ['image/webp'],
    match: (buf) => buf.length >= 12 && buf.subarray(0, 4).toString('ascii') === 'RIFF' && buf.subarray(8, 12).toString('ascii') === 'WEBP',
  },
  '.docx': {
    mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip'],
    match: (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04,
  },
  '.pptx': {
    mimes: ['application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/zip'],
    match: (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04,
  },
  '.xlsx': {
    mimes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip'],
    match: (buf) => buf.length >= 4 && buf[0] === 0x50 && buf[1] === 0x4B && buf[2] === 0x03 && buf[3] === 0x04,
  },
  '.txt': {
    mimes: ['text/plain'],
    match: (buf) => buf.length > 0 && !buf.includes(0x00),
  },
});

const sanitizeFilename = (name) => {
  const base = path.basename(String(name || 'file')).replace(/[^A-Za-z0-9._-]/g, '_');
  return base.slice(0, 180) || 'file';
};

const validateUploadedFile = (file) => {
  if (!file || !Buffer.isBuffer(file.buffer) || file.buffer.length === 0) {
    throw new AppError('A non-empty file upload is required.', 400);
  }

  const maxBytes = config.storage.maxFileSizeMb * 1024 * 1024;
  if (file.size > maxBytes || file.buffer.length > maxBytes) {
    throw new AppError(`File size exceeds limit of ${config.storage.maxFileSizeMb} MB.`, 413);
  }

  const cleanName = sanitizeFilename(file.originalname);
  const ext       = path.extname(cleanName).toLowerCase();
  const spec      = ALLOWED_FILE_SPECS[ext];
  if (!spec) {
    throw new AppError(
      `Unsupported file extension "${ext || 'none'}". Allowed: ${Object.keys(ALLOWED_FILE_SPECS).join(', ')}`,
      400
    );
  }

  const mime = String(file.mimetype || '').toLowerCase().split(';')[0].trim();
  if (!spec.mimes.includes(mime)) {
    throw new AppError(`MIME type "${mime}" is not allowed for "${ext}" files.`, 400);
  }

  if (!spec.match(file.buffer)) {
    throw new AppError(`File signature does not match "${ext}" format. Potentially spoofed or corrupted file rejected.`, 400);
  }

  const fileHash = crypto.createHash('sha256').update(file.buffer).digest('hex');

  return {
    cleanName,
    ext,
    mimeType: mime,
    size    : file.buffer.length,
    buffer  : file.buffer,
    fileHash,
  };
};

const generateStorageKey = (namespace, ownerSegment, ext) => {
  const safeNs    = String(namespace).replace(/[^a-zA-Z0-9_-]/g, '');
  const safeOwner = String(ownerSegment || 'common').replace(/[^a-zA-Z0-9_-]/g, '');
  return `${safeNs}/${safeOwner}/${uuidv4()}${ext}`;
};

const uploadSingleFile = (fieldName = 'file') => {
  const upload = multer({
    storage: multer.memoryStorage(),
    limits : {
      fileSize: config.storage.maxFileSizeMb * 1024 * 1024,
      files   : 1,
    },
  });

  return (req, res, next) => {
    upload.single(fieldName)(req, res, (err) => {
      if (err) return next(err);
      if (!req.file) return next();
      try {
        req.validatedFile = validateUploadedFile(req.file);
        return next();
      } catch (validationErr) {
        return next(validationErr);
      }
    });
  };
};

module.exports = {
  ALLOWED_FILE_SPECS,
  sanitizeFilename,
  validateUploadedFile,
  generateStorageKey,
  uploadSingleFile,
};

