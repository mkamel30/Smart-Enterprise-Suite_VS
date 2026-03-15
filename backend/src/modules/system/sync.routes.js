const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken, requireSuperAdmin } = require('../../../middleware/auth');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { calculateAllMetrics } = require('../../shared/metricsCache.service');
const { createBackup } = require('../../../utils/backup');
const { z } = require('zod');

/**
 * Admin Sync Routes
 * These endpoints allow the central management portal to interact with the branch.
 * For now, protected by Super Admin role, but could be enhanced with API Keys.
 */

// GET /api/system/sync/heartbeat - Quick check if branch is alive
router.get('/heartbeat', authenticateToken, asyncHandler(async (req, res) => {
    return success(res, {
        status: 'online',
        branchId: req.user.branchId || 'MASTER',
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: new Date().toISOString()
    });
}));

// GET /api/system/sync/metrics - Pull latest metrics from branch
router.get('/metrics', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    // Force recalculation of metrics
    const metrics = await calculateAllMetrics();
    return success(res, metrics);
}));

// POST /api/system/sync/parameters - Push global params from Master to Branch
router.post('/parameters', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    const { machineParameters, constants } = req.body;

    if (!machineParameters && !constants) {
        return error(res, 'No data to sync', 400);
    }

    await db.$transaction(async (tx) => {
        if (machineParameters && Array.isArray(machineParameters)) {
            // Update or create machine parameters
            for (const param of machineParameters) {
                await tx.machineParameter.upsert({
                    where: { prefix: param.prefix },
                    update: { model: param.model, manufacturer: param.manufacturer },
                    create: { prefix: param.prefix, model: param.model, manufacturer: param.manufacturer }
                });
            }
        }
        
        // Potential for more global settings here
    });

    return success(res, { message: 'Parameters synced successfully' });
}));

// POST /api/system/sync/trigger-backup - Remotely trigger a backup and get metadata
router.post('/trigger-backup', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    const backup = await createBackup('remote_sync');
    return success(res, backup);
}));

module.exports = router;
