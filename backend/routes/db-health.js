/**
 * Database Health Check Route
 * Provides endpoints for monitoring database status
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const fs = require('fs');
const path = require('path');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db');

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
            connectionTime: `${connectionTime}ms`,
            timestamp: new Date().toISOString()
        };

        // Get file stats
        if (fs.existsSync(DB_PATH)) {
            const stats = fs.statSync(DB_PATH);
            dbStats.fileSize = `${(stats.size / 1024 / 1024).toFixed(2)} MB`;
            dbStats.lastModified = stats.mtime.toISOString();
        }

        // Check journal mode (SQLite specific)
        try {
            const walMode = await db.$queryRaw`PRAGMA journal_mode`;
            dbStats.journalMode = walMode[0]?.journal_mode || 'unknown';
        } catch (e) {
            dbStats.journalMode = 'not_sqlite';
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
        let result;
        try {
            result = await db.$queryRaw`PRAGMA integrity_check`;
        } catch (e) {
            return res.json({ status: 'unsupported', message: 'Integrity check only supported on SQLite', timestamp: new Date().toISOString() });
        }
        const isOk = result[0]?.integrity_check === 'ok';

        res.json({
            status: isOk ? 'ok' : 'issues_found',
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
        stats.customers = await db.customer.count();
        stats.maintenanceRequests = await db.maintenanceRequest.count();
        stats.payments = await db.payment.count();
        stats.inventoryItems = await db.inventoryItem.count();
        stats.spareParts = await db.sparePart.count();
        stats.warehouseMachines = await db.warehouseMachine.count();
        stats.warehouseSims = await db.warehouseSim.count();

        // Get database size
        if (fs.existsSync(DB_PATH)) {
            const dbStats = fs.statSync(DB_PATH);
            stats.databaseSize = `${(dbStats.size / 1024 / 1024).toFixed(2)} MB`;
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
        try {
            await db.$executeRaw`VACUUM`;
            await db.$executeRaw`ANALYZE`;
        } catch (e) {
            // Postgres uses VACUUM ANALYZE differently but we'll stick to SQLite logic or skip
            return res.json({ status: 'skipped', message: 'Optimization skipped (not SQLite)' });
        }

        res.json({
            status: 'optimized',
            message: 'Database vacuumed and analyzed successfully',
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
