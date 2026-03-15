const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');
const { getBranchFilter, requirePermission, PERMISSIONS } = require('../../middleware/permissions');
const { ensureBranchWhere } = require('../../prisma/branchHelpers');
const { isGlobalRole } = require('../../utils/constants');
const reportService = require('../../services/reportService');
const { asyncHandler } = require('../../utils/errorHandler');
const { getAuthorizedBranchIds } = require('../../utils/branchUtils');

// GET Current Inventory Report
router.get('/inventory', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL, PERMISSIONS.INVENTORY_VIEW_BRANCH), async (req, res) => {
    try {
        let { branchId } = req.query;
        const isAdmin = isGlobalRole(req.user.role);

        // If not admin, force their branch
        // If not admin, restrict to authorized branches
        if (!isAdmin) {
            const authorizedIds = getAuthorizedBranchIds(req.user);
            // If requesting specific branch, check authorization
            if (branchId && !authorizedIds.includes(branchId)) {
                branchId = req.user.branchId;
            }
            // If no branch requested, let getBranchFilter handle it (returns all authorized)
        }

        const branchFilter = branchId ? { branchId } : getBranchFilter(req);
        const parts = await db.sparePart.findMany({
            include: {
                inventoryItems: {
                    where: branchFilter
                }
            }
        });

        const report = parts.map(part => {
            const quantity = part.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
            return {
                id: part.id,
                partNumber: part.partNumber,
                name: part.name,
                defaultCost: part.defaultCost,
                quantity: quantity
            };
        });

        res.json(report);
    } catch (error) {
        console.error('Failed to generate inventory report:', error);
        res.status(500).json({ error: 'Failed to generate inventory report' });
    }
});

// GET Stock Movements Report (OUT)
router.get('/movements', authenticateToken, requirePermission(PERMISSIONS.ANALYTICS_VIEW_INVENTORY), async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        // Build dates normalized to LOCAL boundaries
        const today = new Date();
        const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
        const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0);

        dateStart.setHours(0, 0, 0, 0);
        dateEnd.setHours(23, 59, 59, 999);

        const dateFilter = { gte: dateStart, lte: dateEnd };

        // Get OUT movements
        let { branchId } = req.query;
        const isAdmin = isGlobalRole(req.user.role);
        if (!isAdmin) {
            const authorizedIds = getAuthorizedBranchIds(req.user);
            if (branchId && !authorizedIds.includes(branchId)) {
                branchId = req.user.branchId;
            }
        }

        const branchFilter = branchId ? { branchId } : getBranchFilter(req);

        const movements = await db.stockMovement.findMany(ensureBranchWhere({
            where: {
                type: 'OUT',
                createdAt: dateFilter,
                ...branchFilter
            },
            orderBy: { createdAt: 'desc' }
        }, req));

        // Get related requests manually
        const requestIds = [...new Set(movements.map(m => m.requestId).filter(id => id))];
        const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: { id: { in: requestIds } },
            include: {
                posMachine: true,
                customer: true
            }
        }, req));
        const requestMap = Object.fromEntries(requests.map(r => [r.id, r]));

        // Get parts details
        const partIds = [...new Set(movements.map(m => m.partId))];
        const parts = await db.sparePart.findMany({
            where: { id: { in: partIds } }
        });
        const partMap = Object.fromEntries(parts.map(p => [p.id, p]));

        // Group by Part and by Date
        const grouped = {};
        const dailyStats = {};
        const dailyDetailMap = {}; // Helper for aggregation: { date: { partId: { ... } } }

        movements.forEach(m => {
            const dateStr = new Date(m.createdAt).toLocaleDateString('en-CA'); // YYYY-MM-DD
            const quantity = m.quantity || 0;

            // 1. Daily Stats (for chart)
            dailyStats[dateStr] = (dailyStats[dateStr] || 0) + quantity;

            // 2. Part Mapping
            const part = partMap[m.partId];
            if (!part && !m.partId) return;

            const partName = part?.name || 'Unknown';
            const partNumber = part?.partNumber || '';

            // 3. Resolve Request/Machine Info
            let machineInfo = null;
            let clientNumber = null;

            const request = m.requestId ? requestMap[m.requestId] : null;
            if (request && request.posMachine) {
                machineInfo = request.posMachine.serialNumber;
                clientNumber = request.customer?.bkcode;
            } else if (m.reason) {
                machineInfo = m.reason; // Manual reason
                clientNumber = "Manual";
            }

            // 4. Determine Payment Status - Use the definitive isPaid flag on the movement
            const isPaid = m.isPaid === true;

            // 5. Group by Part (Default View - Summary)
            if (!grouped[m.partId]) {
                grouped[m.partId] = {
                    partId: m.partId,
                    partName: partName,
                    partNumber: partNumber,
                    totalQuantity: 0,
                    totalQuantityPaid: 0,
                    totalQuantityUnpaid: 0,
                    machines: []
                };
            }
            grouped[m.partId].totalQuantity += quantity;
            if (isPaid) {
                grouped[m.partId].totalQuantityPaid += quantity;
            } else {
                grouped[m.partId].totalQuantityUnpaid += quantity;
            }

            if (machineInfo && !grouped[m.partId].machines.includes(machineInfo)) {
                grouped[m.partId].machines.push(machineInfo);
            }

            // 6. Group by Day (Aggregated View)
            if (!dailyDetailMap[dateStr]) {
                dailyDetailMap[dateStr] = {};
            }
            if (!dailyDetailMap[dateStr][m.partId]) {
                dailyDetailMap[dateStr][m.partId] = {
                    partName,
                    partNumber,
                    quantity: 0,
                    quantityPaid: 0,
                    quantityUnpaid: 0,
                    machines: new Set(),
                    clients: new Set()
                };
            }

            const dayItem = dailyDetailMap[dateStr][m.partId];
            dayItem.quantity += quantity;
            if (isPaid) dayItem.quantityPaid += quantity;
            else dayItem.quantityUnpaid += quantity;

            if (machineInfo) dayItem.machines.add(machineInfo);
            if (clientNumber) dayItem.clients.add(clientNumber);
        });

        const report = Object.values(grouped).map(item => ({
            ...item,
            machinesText: item.machines.join(' ; ')
        }));

        // Format daily stats for chart
        const dailyChartData = Object.entries(dailyStats)
            .map(([date, count]) => ({ date, count }))
            .sort((a, b) => a.date.localeCompare(b.date));

        // Transform and sort daily detail
        const sortedDailyDetail = Object.keys(dailyDetailMap)
            .sort((a, b) => b.localeCompare(a))
            .reduce((obj, date) => {
                const parts = Object.values(dailyDetailMap[date]).map(p => ({
                    ...p,
                    machine: Array.from(p.machines).join(' ; '),
                    client: Array.from(p.clients).join(' ; ')
                }));
                obj[date] = parts;
                return obj;
            }, {});

        res.json({
            items: report,
            dailyStats: dailyChartData,
            dailyDetail: sortedDailyDetail
        });
    } catch (error) {
        console.error('Failed to generate movements report:', error);
        res.status(500).json({ error: 'Failed to generate movements report' });
    }
});

/**
 * GET /reports/inventory-movement
 * Time-series data showing spare parts usage allocation by month
 */
router.get('/inventory-movement', authenticateToken, requirePermission(PERMISSIONS.ANALYTICS_VIEW_INVENTORY), asyncHandler(async (req, res) => {
    const { from, to, branchId, warehouseId, groupBy, page, pageSize } = req.query;
    const data = await reportService.getInventoryMovement({ from, to, branchId, warehouseId, groupBy, page, pageSize }, req);
    res.json(data);
}));

/**
 * GET /reports/pos-stock
 * Current snapshot of warehouse machine inventory by branch and model
 */
router.get('/pos-stock', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_VIEW_ALL, PERMISSIONS.INVENTORY_VIEW_BRANCH), asyncHandler(async (req, res) => {
    const { branchId, model, warehouseId, includeOutOfStock, sortBy } = req.query;
    const data = await reportService.getPosStock({ branchId, model, warehouseId, includeOutOfStock, sortBy }, req);
    res.json(data);
}));

module.exports = router;
