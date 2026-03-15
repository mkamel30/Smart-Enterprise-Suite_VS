const express = require('express');
const router = express.Router();

const inventoryRoutes = require('./inventory.js');
const financialsRoutes = require('./financials.js');
const performanceRoutes = require('./performance.js');
const monthlyClosingRoutes = require('./monthly-closing.js');

router.use('/', inventoryRoutes);
router.use('/', financialsRoutes);
router.use('/', performanceRoutes);
router.use('/', monthlyClosingRoutes);

module.exports = router;
module.exports.executiveHandler = financialsRoutes.executiveHandler;
