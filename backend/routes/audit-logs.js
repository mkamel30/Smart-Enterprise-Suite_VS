const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const inventoryService = require('../services/inventoryService');

// GET unified audit logs
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { entityType, entityId } = req.query;

        // Security: Filter by branch unless admin
        const branchFilter = getBranchFilter(req) || {};

        // 1. Fetch System Logs
        const where = {
            ...branchFilter
        };

        if (entityType && entityType !== 'ALL') {
            where.entityType = entityType;
        }

        if (entityId) {
            where.entityId = entityId;
        }

        const systemLogs = await db.systemLog.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100
        }, req));

        // 2. If entityType is REQUEST, fetch Stock Movements too
        let combinedLogs = systemLogs;

        if (entityType === 'REQUEST' && entityId) {
            req.query.requestId = entityId; // Map for inventoryService.getMovements
            const stockMovements = await inventoryService.getMovements(req);

            // Map StockMovements to AuditLog format
            const mappedMovements = stockMovements.map(m => ({
                id: `mov-${m.id}`,
                action: 'PART_USAGE',
                details: JSON.stringify({
                    partName: m.partName,
                    partNumber: m.partNumber,
                    quantity: m.quantity,
                    type: m.type,
                    reason: m.reason,
                    performedBy: m.performedBy
                }),
                performedBy: m.performedBy,
                createdAt: m.createdAt,
                entityType: 'REQUEST',
                isStockMovement: true
            }));

            // Combine and sort
            combinedLogs = [...systemLogs, ...mappedMovements].sort((a, b) =>
                new Date(b.createdAt) - new Date(a.createdAt)
            );
        }

        res.json(combinedLogs);
    } catch (error) {
        console.error('Failed to fetch audit logs:', error);
        res.status(500).json({ error: 'Failed to fetch logs' });
    }
});

module.exports = router;
