'use strict';

const express = require('express');
const router  = express.Router();
const { config } = require('../config');
const { v1Routes, livenessHandler, healthHandler } = require('./v1.routes');

// Root liveness & readiness health checks (unauthenticated)
router.get('/health',       healthHandler);
router.get('/health/live',  livenessHandler);
router.get('/health/ready', healthHandler);

// Versioned REST API routes (/api/v1)
router.use(`/api/${config.app.version}`, v1Routes);

module.exports = router;
