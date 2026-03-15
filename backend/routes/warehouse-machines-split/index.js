const express = require('express');
const router = express.Router();

const coreRoutes = require('./core');
const ioRoutes = require('./io');
const opsRoutes = require('./operations');
const externalRoutes = require('./external');

router.use('/', coreRoutes);
router.use('/', ioRoutes);
router.use('/', opsRoutes);
router.use('/external-repair', externalRoutes);

module.exports = router;
