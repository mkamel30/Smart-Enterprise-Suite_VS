const express = require('express');
const router = express.Router();

const coreRoutes = require('./core.js');
const ioRoutes = require('./io.js');
const opsRoutes = require('./operations.js');
const externalRoutes = require('./external.js');

router.use('/', coreRoutes);
router.use('/', ioRoutes);
router.use('/', opsRoutes);
router.use('/external-repair', externalRoutes);

module.exports = router;
