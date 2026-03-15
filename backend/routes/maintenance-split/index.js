const express = require('express');
const router = express.Router();

const shipmentRoutes = require('./shipments');
const workflowRoutes = require('./workflow');
const operationRoutes = require('./operations');
const approvalRoutes = require('./approvals');
const reportRoutes = require('./reports');

router.use('/shipments', shipmentRoutes);
router.use('/approvals', approvalRoutes);
router.use('/', reportRoutes);
router.use('/', workflowRoutes);
router.use('/', operationRoutes);

module.exports = router;
