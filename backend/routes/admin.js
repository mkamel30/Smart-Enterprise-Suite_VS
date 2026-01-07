const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL
const prisma = new PrismaClient();

// GET Audit Logs
router.get('/audit-logs', async (req, res) => {
    try {
        const { entityType, entityId, limit } = req.query;

        const where = {};
        if (entityType) where.entityType = entityType;
        if (entityId) where.entityId = entityId;

        let logs = await prisma.systemLog.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit ? parseInt(limit) : 100
        }, req));

        // If it's a customer, also fetch from specific movement logs to provide a unified history
        if (entityType === 'CUSTOMER' && entityId) {
            // Find machine movements related to this customer (customerId is stored in details string)
            const machineLogs = await prisma.machineMovementLog.findMany(ensureBranchWhere({
                where: {
                    details: {
                        contains: `"customerId":"${entityId}"`
                    }
                }
            }, req));

            // Find SIM movements related to this customer
            const simLogs = await prisma.simMovementLog.findMany(ensureBranchWhere({
                where: {
                    details: {
                        contains: `"customerId":"${entityId}"`
                    }
                }
            }, req));

            // Transform movement logs to match SystemLog format for the frontend
            const transformedMachineLogs = machineLogs.map(l => {
                let detailsObj = {};
                try { detailsObj = JSON.parse(l.details || '{}'); }
                catch (e) { detailsObj = { message: l.details }; }

                // Ensure serialNumber is in details for frontend formatting
                detailsObj.serialNumber = l.serialNumber;

                return {
                    id: l.id,
                    entityType: 'CUSTOMER',
                    entityId: entityId,
                    action: l.action,
                    details: JSON.stringify(detailsObj),
                    performedBy: l.performedBy || 'System',
                    createdAt: l.createdAt,
                    branchId: l.branchId
                };
            });

            const transformedSimLogs = simLogs.map(l => {
                let detailsObj = {};
                try { detailsObj = JSON.parse(l.details || '{}'); }
                catch (e) { detailsObj = { message: l.details }; }

                // Ensure serialNumber is in details for frontend formatting
                detailsObj.serialNumber = l.serialNumber;

                return {
                    id: l.id,
                    entityType: 'CUSTOMER',
                    entityId: entityId,
                    action: l.action,
                    details: JSON.stringify(detailsObj),
                    performedBy: l.performedBy || 'System',
                    createdAt: l.createdAt,
                    branchId: l.branchId
                };
            });

            // Merge and re-sort
            logs = [...logs, ...transformedMachineLogs, ...transformedSimLogs];
            logs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
            if (limit) logs = logs.slice(0, parseInt(limit));
        }

        res.json(logs);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch audit logs' });
    }
});

module.exports = router;
