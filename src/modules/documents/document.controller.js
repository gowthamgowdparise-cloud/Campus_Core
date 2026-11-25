'use strict';

const documentService = require('./document.service');
const catchAsync      = require('../../utils/catchAsync');
const { sendSuccess } = require('../../utils/apiResponse');

const list = catchAsync(async (req, res) => {
  const { documents, meta } = await documentService.listDocuments(req.query, req.user);
  sendSuccess(res, 200, 'Documents retrieved successfully', documents, meta);
});

const getById = catchAsync(async (req, res) => {
  const doc = await documentService.getDocumentById(req.params.id, req.user);
  sendSuccess(res, 200, 'Document retrieved successfully', doc);
});

const create = catchAsync(async (req, res) => {
  const doc = await documentService.createDocument(req.body, req.validatedFile, req.user);
  sendSuccess(res, 201, 'Document uploaded successfully', doc);
});

const download = catchAsync(async (req, res) => {
  const result = await documentService.downloadDocument(req.params.id, req.user);
  if (result.mode === 'presigned_url') {
    return sendSuccess(res, 200, 'Presigned download URL generated', {
      downloadUrl: result.url,
      expiresIn  : result.expiresIn,
      fileName   : result.fileName,
    });
  }

  const safeName = (result.fileName || 'document').replace(/["\\\r\n]/g, '_');
  res.setHeader('Content-Type', result.mimeType || 'application/octet-stream');
  res.setHeader('Content-Disposition', `attachment; filename="${safeName}"`);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-store');
  result.stream.pipe(res);
});

const verify = catchAsync(async (req, res) => {
  const doc = await documentService.verifyDocument(req.params.id, req.body, req.user.id);
  sendSuccess(res, 200, `Document ${req.body.decision}`, doc);
});

const remove = catchAsync(async (req, res) => {
  await documentService.deleteDocument(req.params.id, req.user);
  sendSuccess(res, 200, 'Document deleted successfully');
});

module.exports = { list, getById, create, download, verify, remove };
