const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken, requireSuperAdmin } = require('../../../middleware/auth');
const portalAuth = require('../../../middleware/portalAuth');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { calculateAllMetrics } = require('../shared/metricsCache.service');
const { createBackup } = require('../../../utils/backup');
const { z } = require('zod');

/**
 * Admin Sync Routes
 * These endpoints allow the central management portal to interact with the branch.
 * For now, protected by Super Admin role, but could be enhanced with API Keys.
 */

// GET /api/system/sync/heartbeat - Quick check if branch is alive
router.get('/heartbeat', portalAuth, asyncHandler(async (req, res) => {
    return success(res, {
        status: 'online',
        branchId: process.env.BRANCH_CODE || 'BR001',
        version: process.env.APP_VERSION || '1.0.0',
        timestamp: new Date().toISOString()
    });
}));

// GET /api/system/sync/metrics - Pull latest metrics from branch
router.get('/metrics', portalAuth, asyncHandler(async (req, res) => {
    // Force recalculation of metrics
    const metrics = await calculateAllMetrics();
    return success(res, metrics);
}));

// POST /api/system/sync/parameters - Push global params from Master to Branch (Backup mechanism)
router.post('/parameters', portalAuth, asyncHandler(async (req, res) => {
    const { machineParameters, globalParameters } = req.body;

    if (!machineParameters && !globalParameters) {
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

        if (globalParameters && Array.isArray(globalParameters)) {
            // Update or create global parameters
            for (const param of globalParameters) {
                await tx.globalParameter.upsert({
                    where: { key: param.key },
                    update: { 
                        value: String(param.value), 
                        type: param.type || 'STRING',
                        group: param.group || null
                    },
                    create: { 
                        key: param.key, 
                        value: String(param.value), 
                        type: param.type || 'STRING',
                        group: param.group || null
                    }
                });
            }
        }
    });

    return success(res, { message: 'Parameters synced successfully' });
}));

// POST /api/system/sync/trigger-backup - Remotely trigger a backup and get metadata
router.post('/trigger-backup', portalAuth, asyncHandler(async (req, res) => {
    const backup = await createBackup('remote_sync');
    return success(res, backup);
}));

module.exports = router;
