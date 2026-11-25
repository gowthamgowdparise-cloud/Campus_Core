'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./document.controller');
const schemas  = require('./document.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { auditLogger }       = require('../../middleware/auditLogger');
const { uploadSingleFile }  = require('../../middleware/upload');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate);

router.get('/', requirePermission(PERMISSIONS.DOCUMENTS_READ), validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), requirePermission(PERMISSIONS.DOCUMENTS_READ), ctrl.getById);

router.get(
  '/:id/download',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.DOCUMENTS_READ),
  auditLogger('DOCUMENT_ACCESS', 'documents', { logReads: true, entityType: 'Document', getEntityId: (req) => req.params.id }),
  ctrl.download
);

router.post(
  '/',
  requirePermission(PERMISSIONS.DOCUMENTS_UPLOAD),
  uploadSingleFile('file'),
  validate(schemas.create),
  auditLogger('DOCUMENT_UPLOAD', 'documents', { entityType: 'Document' }),
  ctrl.create
);

router.patch(
  '/:id/verify',
  validate(idParamSchema, 'params'),
  authorize('admin', 'faculty'),
  requirePermission(PERMISSIONS.DOCUMENTS_VERIFY),
  validate(schemas.verify),
  auditLogger('DOCUMENT_VERIFY', 'documents', { entityType: 'Document', getEntityId: (req) => req.params.id }),
  ctrl.verify
);

router.delete(
  '/:id',
  validate(idParamSchema, 'params'),
  requirePermission(PERMISSIONS.DOCUMENTS_READ),
  auditLogger('DOCUMENT_DELETE', 'documents', { entityType: 'Document', getEntityId: (req) => req.params.id }),
  ctrl.remove
);

module.exports = router;
