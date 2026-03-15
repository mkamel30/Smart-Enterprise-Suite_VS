const express = require('express');
const router = express.Router();
const db = require('../db');
const config = require('../config');
const { success } = require('../utils/apiResponse');
const os = require('os');

/**
 * GET /api/health
 * Basic health check
 */
router.get('/', (req, res) => {
    return success(res, {
        status: 'ok',
        version: '1.0.0',
        environment: config.nodeEnv,
        uptime: process.uptime()
    });
});

/**
 * GET /api/health/detailed
 * Detailed system and database health
 */
router.get('/detailed', async (req, res) => {
    const startTime = Date.now();
    let dbStatus = 'ok';
    let dbError = null;

    try {
        await db.$queryRaw`SELECT 1`;
    } catch (err) {
        dbStatus = 'error';
        dbError = err.message;
    }

    const health = {
        status: dbStatus === 'ok' ? 'ok' : 'degraded',
        database: {
            status: dbStatus,
            latency: `${Date.now() - startTime}ms`,
            error: dbError
        },
        system: {
            platform: os.platform(),
            arch: os.arch(),
            cpus: os.cpus().length,
            freeMemory: `${Math.round(os.freemem() / 1024 / 1024)}MB`,
            totalMemory: `${Math.round(os.totalmem() / 1024 / 1024)}MB`,
            loadAvg: os.loadavg()
        },
        process: {
            pid: process.pid,
            uptime: `${Math.round(process.uptime())}s`,
            memoryUsage: process.memoryUsage()
        },
        timestamp: new Date().toISOString()
    };

    return success(res, health);
});

module.exports = router;
