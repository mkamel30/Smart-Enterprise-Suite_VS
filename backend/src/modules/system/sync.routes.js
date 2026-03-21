const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken, requireSuperAdmin } = require('../../../middleware/auth');
const portalAuth = require('../../../middleware/portalAuth');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { calculateAllMetrics } = require('../shared/metricsCache.service');
const { createBackup } = require('../../../utils/backup');
const adminSyncService = require('../../services/adminSync.service');
const { z } = require('zod');

/**
 * Admin Sync Routes
 * These endpoints allow the central management portal to interact with the branch.
 * For now, protected by Super Admin role, but could be enhanced with API Keys.
 */

// GET /api/system/sync/status - Get portal sync connection status
router.get('/status', authenticateToken, asyncHandler(async (req, res) => {
    return success(res, adminSyncService.getStatus());
}));

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
    const { machineParameters, globalParameters, masterSpareParts, sparePartPriceLogs, users } = req.body;

    if (!machineParameters && !globalParameters && !masterSpareParts && !sparePartPriceLogs && !users) {
        return error(res, 'No data to sync', 400);
    }

    await db.$transaction(async (tx) => {
        if (machineParameters && Array.isArray(machineParameters)) {
            for (const param of machineParameters) {
                await tx.machineParameter.upsert({
                    where: { prefix: param.prefix },
                    update: { model: param.model, manufacturer: param.manufacturer },
                    create: { prefix: param.prefix, model: param.model, manufacturer: param.manufacturer }
                });

                // Update POS machines and warehouse machines matching this prefix
                if (param.prefix && param.model) {
                    await tx.posMachine.updateMany({
                        where: { serialNumber: { startsWith: param.prefix } },
                        data: { model: param.model, manufacturer: param.manufacturer }
                    }).catch(() => {});
                    await tx.warehouseMachine.updateMany({
                        where: { serialNumber: { startsWith: param.prefix } },
                        data: { model: param.model, manufacturer: param.manufacturer }
                    }).catch(() => {});
                }
            }
        }

        if (masterSpareParts && Array.isArray(masterSpareParts)) {
            for (const part of masterSpareParts) {
                await tx.masterSparePart.upsert({
                    where: { id: part.id },
                    update: {
                        partNumber: part.partNumber,
                        name: part.name,
                        description: part.description,
                        compatibleModels: part.compatibleModels,
                        defaultCost: part.defaultCost,
                        isConsumable: part.isConsumable,
                        category: part.category
                    },
                    create: {
                        id: part.id,
                        partNumber: part.partNumber,
                        name: part.name,
                        description: part.description,
                        compatibleModels: part.compatibleModels,
                        defaultCost: part.defaultCost,
                        isConsumable: part.isConsumable,
                        category: part.category
                    }
                });
            }
        }

        if (sparePartPriceLogs && Array.isArray(sparePartPriceLogs)) {
            for (const log of sparePartPriceLogs) {
                await tx.sparePartPriceLog.upsert({
                    where: { id: log.id },
                    update: {
                        oldCost: log.oldCost,
                        newCost: log.newCost,
                        changedBy: log.changedBy
                    },
                    create: {
                        id: log.id,
                        partId: log.partId,
                        oldCost: log.oldCost,
                        newCost: log.newCost,
                        changedBy: log.changedBy
                    }
                });
            }
        }

        if (users && Array.isArray(users)) {
            for (const user of users) {
                await tx.user.upsert({
                    where: { username: user.username },
                    update: {
                        uid: user.uid,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        password: user.password,
                        isActive: user.isActive,
                        branchId: user.branchId
                    },
                    create: {
                        id: user.id || undefined,
                        uid: user.uid,
                        username: user.username,
                        email: user.email,
                        displayName: user.displayName,
                        role: user.role,
                        password: user.password,
                        isActive: user.isActive,
                        branchId: user.branchId
                    }
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

// POST /api/system/sync/request-sync - HTTP fallback: branch requests data from portal
router.post('/request-sync', portalAuth, asyncHandler(async (req, res) => {
    const { entities } = req.body || {};
    const axios = require('axios');

    const portalUrl = process.env.PORTAL_URL;
    const apiKey = process.env.PORTAL_API_KEY;

    if (!portalUrl || !apiKey) {
        return error(res, 'PORTAL_URL not configured', 500);
    }

    try {
        const response = await axios.post(
            `${portalUrl}/api/system/sync/request-sync`,
            { entities: entities || ['branches', 'users', 'machineParameters', 'masterSpareParts', 'sparePartPriceLogs', 'globalParameters'] },
            {
                headers: {
                    'x-portal-sync-key': apiKey,
                    'Content-Type': 'application/json'
                },
                timeout: 30000
            }
        );
        return success(res, response.data);
    } catch (err) {
        console.error('[Sync] HTTP fallback request failed:', err.message);
        return error(res, 'Failed to request sync from portal', 502);
    }
}));

// GET /api/system/update/check - Check for system updates (self-hosted)
router.get('/update/check', authenticateToken, asyncHandler(async (req, res) => {
    const currentVersion = process.env.APP_VERSION || '1.0.0';
    return success(res, {
        currentVersion,
        latestVersion: currentVersion,
        updateAvailable: false,
        releaseNotes: '',
        downloadUrl: ''
    });
}));

module.exports = router;
