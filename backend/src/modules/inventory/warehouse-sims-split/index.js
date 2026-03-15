const express = require('express');
const router = express.Router();

const coreRoutes = require('./core.js');
const opsRoutes = require('./ops.js');
const ioRoutes = require('./io.js');

router.use('/', coreRoutes);
router.use('/', opsRoutes);
router.use('/', ioRoutes);

module.exports = router;
