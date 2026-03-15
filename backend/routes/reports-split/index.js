const express = require('express');
const router = express.Router();

const inventoryRoutes = require('./inventory');
const financialsRoutes = require('./financials');
const performanceRoutes = require('./performance');
const monthlyClosingRoutes = require('./monthly-closing');

router.use('/', inventoryRoutes);
router.use('/', financialsRoutes);
router.use('/', performanceRoutes);
router.use('/', monthlyClosingRoutes);

module.exports = router;
module.exports.executiveHandler = financialsRoutes.executiveHandler;
