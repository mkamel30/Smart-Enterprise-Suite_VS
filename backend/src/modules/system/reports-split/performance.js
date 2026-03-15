const express = require('express');
const router = express.Router();
const db = require('../../../../db');
const { authenticateToken } = require('../../../../middleware/auth');
const { getBranchFilter, requirePermission, PERMISSIONS } = require('../../../../middleware/permissions');
const { ensureBranchWhere } = require('../../../../prisma/branchHelpers');
const { isGlobalRole } = require('../../../../utils/constants');
const reportService = require('../report.service.js');
const { asyncHandler } = require('../../../../utils/errorHandler');
const { getAuthorizedBranchIds } = require('../../../../utils/branchUtils');

// GET Performance Analysis Report
router.get('/performance', authenticateToken, requirePermission(PERMISSIONS.REPORTS_ALL, PERMISSIONS.REPORTS_BRANCH), async (req, res) => {
    try {
        let { startDate, endDate, branchId } = req.query;
        const isAdmin = isGlobalRole(req.user.role);
        if (!isAdmin && branchId) {
            const authorizedIds = getAuthorizedBranchIds(req.user);
            if (!authorizedIds.includes(branchId)) {
                branchId = req.user.branchId;
            }
        }

        const branchFilter = branchId ? { branchId } : getBranchFilter(req);

        const today = new Date();
        const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
        const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0);

        dateStart.setHours(0, 0, 0, 0);
        dateEnd.setHours(23, 59, 59, 999);

        const whereClause = {
            status: 'Closed',
            closingTimestamp: { gte: dateStart, lte: dateEnd },
            ...branchFilter
        };

        const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: whereClause,
            select: {
                id: true,
                technician: true,
                closingUserName: true,
                createdAt: true,
                closingTimestamp: true,
                totalCost: true,
                usedParts: true
            }
        }, req));

        const technicianStats = {};

        requests.forEach(req => {
            const techName = req.technician || req.closingUserName || 'Unknown';

            if (!technicianStats[techName]) {
                technicianStats[techName] = {
                    name: techName,
                    requestCount: 0,
                    totalRevenue: 0,
                    totalRepairTimeMs: 0,
                    fastestRepairMs: Infinity,
                    slowestRepairMs: 0,
                    partsReplacedCount: 0
                };
            }

            const stats = technicianStats[techName];
            stats.requestCount++;
            stats.totalRevenue += (req.totalCost || 0);

            const start = new Date(req.createdAt).getTime();
            const end = new Date(req.closingTimestamp).getTime();
            const duration = end - start;

            if (duration > 0) {
                stats.totalRepairTimeMs += duration;
                if (duration < stats.fastestRepairMs) stats.fastestRepairMs = duration;
                if (duration > stats.slowestRepairMs) stats.slowestRepairMs = duration;
            }

            if (req.usedParts) {
                try {
                    const parsed = JSON.parse(req.usedParts);
                    const parts = Array.isArray(parsed) ? parsed : (parsed.parts || []);
                    stats.partsReplacedCount += parts.reduce((sum, p) => sum + (p.quantity || 0), 0);
                } catch (e) { }
            }
        });

        const report = Object.values(technicianStats).map(stat => {
            const avgMs = stat.requestCount > 0 ? stat.totalRepairTimeMs / stat.requestCount : 0;
            return {
                name: stat.name,
                requestCount: stat.requestCount,
                totalRevenue: stat.totalRevenue,
                partsReplacedCount: stat.partsReplacedCount,
                avgRepairTimeHours: (avgMs / (1000 * 60 * 60)).toFixed(1),
                avgRepairTimeDays: (avgMs / (1000 * 60 * 60 * 24)).toFixed(1),
                fastestRepairHours: (stat.fastestRepairMs === Infinity ? 0 : stat.fastestRepairMs / (1000 * 60 * 60)).toFixed(1),
                slowestRepairHours: (stat.slowestRepairMs / (1000 * 60 * 60)).toFixed(1)
            };
        }).sort((a, b) => b.requestCount - a.requestCount);

        res.json(report);

    } catch (error) {
        console.error('Failed to generate performance report:', error);
        res.status(500).json({ error: 'Failed to generate performance report' });
    }
});

/**
 * GET /reports/technician-consumption
 */
router.get('/technician-consumption', authenticateToken, requirePermission(PERMISSIONS.REPORTS_ALL, PERMISSIONS.REPORTS_BRANCH), asyncHandler(async (req, res) => {
    const { from, to, branchId, page, pageSize } = req.query;
    const data = await reportService.getTechnicianConsumptionReport({ from, to, branchId, page, pageSize }, req);
    res.json(data);
}));

/**
 * GET /reports/governorate-performance
 */
router.get('/governorate-performance', authenticateToken, requirePermission(PERMISSIONS.REPORTS_ALL, PERMISSIONS.REPORTS_BRANCH), asyncHandler(async (req, res) => {
    const { from, to, branchId, page, pageSize } = req.query;
    const data = await reportService.getGovernoratePerformance({ from, to, branchId, page, pageSize }, req);
    res.json(data);
}));

module.exports = router;
