const express = require('express');
const router = express.Router();
const db = require('../../../db');
const fs = require('fs');
const path = require('path');

// Health check endpoint
router.get('/health', async (req, res) => {
    try {
        const startTime = Date.now();

        // Test database connection
        await db.$queryRaw`SELECT 1`;
        const connectionTime = Date.now() - startTime;

        // Get database info
        const dbStats = {
            status: 'healthy',
            provider: 'sqlite',
            connectionTime: `${connectionTime}ms`,
            timestamp: new Date().toISOString()
        };

        // Get DB size for SQLite
        try {
            const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
            if (fs.existsSync(dbPath)) {
                const stats = fs.statSync(dbPath);
                dbStats.databaseSize = (stats.size / (1024 * 1024)).toFixed(2) + ' MB';
            } else {
                dbStats.databaseSize = 'unknown';
            }
        } catch (e) {
            dbStats.databaseSize = 'error';
        }

        res.json(dbStats);

    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// Integrity check endpoint
router.get('/integrity', async (req, res) => {
    try {
        // SQLite integrity check
        const result = await db.$queryRaw`PRAGMA integrity_check`;
        const status = result[0]?.integrity_check === 'ok' ? 'ok' : 'error';

        res.json({
            status,
            message: status === 'ok' ? 'قاعدة بيانات SQLite سليمة وتعمل بشكل صحيح.' : 'تم اكتشاف مشاكل في تكامل قاعدة البيانات.',
            details: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

// Database statistics
router.get('/stats', async (req, res) => {
    try {
        const stats = {};

        // Count records in main tables
        stats.branches = await db.branch.count();
        stats.users = await db.user.count();
        
        // Skip branch enforcer for global stats
        const bypass = { _skipBranchEnforcer: true };
        stats.customers = await db.customer.count(bypass);
        stats.maintenanceRequests = await db.maintenanceRequest.count(bypass);
        stats.payments = await db.payment.count(bypass);
        stats.inventoryItems = await db.inventoryItem.count(bypass);
        stats.spareParts = await db.sparePart.count();
        stats.warehouseMachines = await db.warehouseMachine.count(bypass);
        stats.warehouseSims = await db.warehouseSim.count(bypass);

        // Get database size
        try {
            const dbPath = path.join(process.cwd(), 'prisma', 'dev.db');
            if (fs.existsSync(dbPath)) {
                const fstats = fs.statSync(dbPath);
                stats.databaseSize = (fstats.size / (1024 * 1024)).toFixed(2) + ' MB';
            }
        } catch (e) {
            stats.databaseSize = 'N/A';
        }

        res.json({
            ...stats,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            error: error.message
        });
    }
});

// Vacuum database (optimize)
router.post('/optimize', async (req, res) => {
    try {
        // SQLite uses VACUUM
        await db.$executeRawUnsafe('VACUUM');

        res.json({
            status: 'optimized',
            message: 'تم تحسين قاعدة البيانات وتحرير المساحة غير المستخدمة بنجاح.',
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        res.status(500).json({
            status: 'error',
            error: error.message
        });
    }
});

module.exports = router;
