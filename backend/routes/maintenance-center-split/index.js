const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../../middleware/auth');

const coreRoutes = require('./core');
const workflowRoutes = require('./workflow');
const disposalRoutes = require('./disposal');

// Apply authentication to all routes
router.use(authenticateToken);

router.use('/', coreRoutes);
router.use('/', workflowRoutes);
router.use('/', disposalRoutes);

module.exports = router;
