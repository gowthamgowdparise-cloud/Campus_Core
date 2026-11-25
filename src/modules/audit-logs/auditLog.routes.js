'use strict';

const express  = require('express');
const router   = express.Router();
const ctrl     = require('./auditLog.controller');
const schemas  = require('./auditLog.validators');
const validate = require('../../middleware/validate');
const { authenticate }      = require('../../middleware/authenticate');
const { authorize, requirePermission } = require('../../middleware/authorize');
const { PERMISSIONS }       = require('../../config/permissions');
const { idParamSchema }     = require('../../validators');

router.use(authenticate, authorize('admin'), requirePermission(PERMISSIONS.AUDIT_LOGS_READ));

router.get('/', validate(schemas.listQuery, 'query'), ctrl.list);
router.get('/:id', validate(idParamSchema, 'params'), ctrl.getById);

module.exports = router;

