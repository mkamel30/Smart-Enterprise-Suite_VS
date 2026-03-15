const express = require('express');
const router = express.Router();

const coreRoutes = require('./core');
const opsRoutes = require('./ops');
const ioRoutes = require('./io');

router.use('/', coreRoutes);
router.use('/', opsRoutes);
router.use('/', ioRoutes);

module.exports = router;
