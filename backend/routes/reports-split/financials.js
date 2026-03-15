const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../../middleware/permissions');
const { ensureBranchWhere } = require('../../prisma/branchHelpers');
const { isGlobalRole } = require('../../utils/constants');
const reportService = require('../../services/reportService');
const { asyncHandler } = require('../../utils/errorHandler');
const { getAuthorizedBranchIds } = require('../../utils/branchUtils');

// GET Executive / High-Level Analytics (Admin Only)
const executiveHandler = async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let { branchId } = req.query;

        // Security: Central roles (Admins) can see all branches, others are locked to their own
        const isCentral = req.user && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'MANAGEMENT' || req.user.role === 'ACCOUNTANT');

        // Security: Central roles (Admins) can see all. Others are checked by ensureBranchWhere.
        // We do strictly set the branchId if provided and valid, or let it be null (all authorized)
        if (!isCentral && branchId) {
            const authorizedIds = getAuthorizedBranchIds(req.user);
            if (!authorizedIds.includes(branchId)) {
                // unauthorized specific request -> force own branch (or could error)
                branchId = req.user.branchId;
            }
        }

        // 1. Normalize dates to LOCAL boundaries for the whole day
        const today = new Date();
        const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
        const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0);

        dateStart.setHours(0, 0, 0, 0);
        dateEnd.setHours(23, 59, 59, 999);

        // DEBUG LOGGING
        const fs = require('fs');
        const path = require('path');
        const logPath = path.join(__dirname, '..', '..', 'accounting_debug.log');
        const log = (msg) => fs.appendFileSync(logPath, `[${new Date().toISOString()}] [FINANCIALS] ${msg}\n`);

        const paymentWhere = { createdAt: { gte: dateStart, lte: dateEnd } };
        if (branchId) paymentWhere.branchId = branchId;

        const salesWhere = { saleDate: { gte: dateStart, lte: dateEnd } };
        if (branchId) salesWhere.branchId = branchId;

        log(`Request: start=${dateStart.toISOString()}, end=${dateEnd.toISOString()}, branch=${branchId || 'ALL'}`);

        // 2. Fetch Data
        const payments = await db.payment.findMany(ensureBranchWhere({ where: paymentWhere }, req));
        const machineSales = await db.machineSale.findMany(ensureBranchWhere({ where: salesWhere }, req));

        // 3. Calculate Categorized Collections (Breakdown)
        const breakdown = {
            machines: 0,
            sims: 0,
            maintenance: 0,
            manual: 0,
            other: 0
        };

        payments.forEach(p => {
            const t = p.type || '';
            const r = p.reason || '';

            if (t === 'INSTALLMENT' || r.includes('قسط') || r.includes('أقساط')) {
                breakdown.machines += p.amount;
            } else if (t === 'SALE' || r.includes('بيع') || r.includes('ماكينة')) {
                breakdown.machines += p.amount;
            } else if (t === 'SIM_PURCHASE' || t === 'SIM_EXCHANGE' || r.includes('شريحة')) {
                breakdown.sims += p.amount;
            } else if (t === 'MAINTENANCE' || r.includes('صيانة') || r.includes('قطع غيار')) {
                breakdown.maintenance += p.amount;
            } else if (t === 'MANUAL') {
                breakdown.manual += p.amount;
            } else {
                breakdown.other += p.amount;
            }
        });

        log(`Results: payments=${payments.length}, machineSales=${machineSales.length}, totalCollected=${Object.values(breakdown).reduce((a, b) => a + b, 0)}`);

        const totalCollected = Object.values(breakdown).reduce((sum, val) => sum + val, 0);

        // 4. Calculate Total Sales Value
        const totalMachineSalesValue = machineSales.reduce((sum, s) => sum + s.totalPrice, 0);
        const directSalesValue = breakdown.sims + breakdown.maintenance + breakdown.manual + breakdown.other;
        const totalSalesValue = totalMachineSalesValue + directSalesValue;

        // 4b. Calculate Pending Dues
        const remainingInstallments = machineSales.reduce((sum, s) => sum + (s.totalPrice - s.paidAmount), 0);

        const isAdmin = isGlobalRole(req.user.role);
        const pendingDebts = await db.branchDebt.findMany({
            where: {
                ...(branchId ? { debtorBranchId: branchId } : (isAdmin ? { debtorBranchId: { not: 'BYPASS' } } : {})),
                status: 'PENDING'
            },
            select: { remainingAmount: true, createdAt: true }
        });
        const pendingMaintenanceDebts = pendingDebts.reduce((sum, p) => sum + p.remainingAmount, 0);

        const totalPendingDues = remainingInstallments + pendingMaintenanceDebts;

        // 4c. Calculate Overdue Debts
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const overdueDebts = pendingDebts
            .filter(p => new Date(p.createdAt) < thirtyDaysAgo)
            .reduce((sum, p) => sum + p.remainingAmount, 0);

        // 4d. Count machines assigned to customers
        const customerMachinesCount = await db.posMachine.count(ensureBranchWhere({
            where: {
                ...(branchId ? { branchId } : {}),
                customerId: { not: null }
            }
        }, req));

        const totalOutstanding = totalSalesValue - totalCollected;

        // 5. Branch Performance Analysis
        const dateFilter = { gte: dateStart, lte: dateEnd };
        const branches = await db.branch.findMany(branchId ? { where: { id: branchId } } : {});
        const branchPerformance = await Promise.all(branches.map(async (branch) => {
            const bPayments = await db.payment.findMany(ensureBranchWhere({ where: { branchId: branch.id, createdAt: dateFilter } }, req));
            const bSales = await db.machineSale.findMany(ensureBranchWhere({ where: { branchId: branch.id, saleDate: dateFilter } }, req));
            const bRequests = await db.maintenanceRequest.count(ensureBranchWhere({
                where: { branchId: branch.id, closingTimestamp: dateFilter, status: 'Closed' }
            }, req));

            const bCollected = bPayments.reduce((sum, p) => sum + p.amount, 0);
            const bMachineSales = bSales.reduce((sum, s) => sum + s.totalPrice, 0);

            const bNonMachine = bPayments
                .filter(p => !['INSTALLMENT', 'MACHINE_SALE'].includes(p.type) && !p.reason?.includes('ماكينة') && !p.reason?.includes('قسط'))
                .reduce((sum, p) => sum + p.amount, 0);

            return {
                id: branch.id,
                name: branch.name,
                revenue: bMachineSales + bNonMachine,
                collections: bCollected,
                salesCount: bSales.length,
                repairCount: bRequests,
                paymentCount: bPayments.length
            };
        }));

        // 6. Inventory Valuation
        const parts = await db.sparePart.findMany({
            include: { inventoryItems: { where: branchId ? { branchId } : {} } }
        });

        let totalInventoryValue = 0;
        parts.forEach(part => {
            const qty = part.inventoryItems.reduce((sum, item) => sum + item.quantity, 0);
            totalInventoryValue += (qty * (part.defaultCost || 0));
        });

        // 7. Trends
        const sixMonthsAgo = new Date();
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        const trendPayments = await db.payment.findMany(ensureBranchWhere({
            where: {
                createdAt: { gte: sixMonthsAgo },
                branchId: branchId || undefined
            }
        }, req));

        const trendSales = await db.machineSale.findMany(ensureBranchWhere({
            where: {
                saleDate: { gte: sixMonthsAgo },
                branchId: branchId || undefined
            }
        }, req));

        const trends = {};
        trendPayments.forEach(p => {
            const month = p.createdAt.toLocaleString('ar-EG', { month: 'long' });
            if (!trends[month]) trends[month] = { name: month, collections: 0, sales: 0 };
            trends[month].collections += p.amount;
        });

        trendSales.forEach(s => {
            const month = s.saleDate.toLocaleString('ar-EG', { month: 'long' });
            if (!trends[month]) trends[month] = { name: month, collections: 0, sales: 0 };
            trends[month].sales += s.totalPrice;
        });

        trendPayments.forEach(p => {
            if (!['INSTALLMENT', 'MACHINE_SALE'].includes(p.type) && !p.reason?.includes('ماكينة') && !p.reason?.includes('قسط')) {
                const month = p.createdAt.toLocaleString('ar-EG', { month: 'long' });
                trends[month].sales += p.amount;
            }
        });

        const trendData = Object.values(trends);

        // 8. Recent Activities
        const recentPayments = await db.payment.findMany(ensureBranchWhere({
            where: paymentWhere,
            orderBy: { createdAt: 'desc' },
            take: 10,
            include: { branch: true }
        }, req));

        const currentPeriodFilter = { gte: dateStart, lte: dateEnd };

        const recentRequests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: {
                ...(branchId ? { branchId } : {}),
                status: 'Closed',
                closingTimestamp: currentPeriodFilter
            },
            orderBy: { closingTimestamp: 'desc' },
            take: 10,
            include: { branch: true, customer: true }
        }, req));

        // 9. Operational Metrics
        const totalRequests = await db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...(branchId ? { branchId } : {}), createdAt: currentPeriodFilter }
        }, req));
        const closedRequests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: { ...(branchId ? { branchId } : {}), status: 'Closed', closingTimestamp: currentPeriodFilter }
        }, req));

        let totalResolutionTime = 0;
        closedRequests.forEach(r => {
            if (r.closingTimestamp && r.createdAt) {
                totalResolutionTime += (new Date(r.closingTimestamp).getTime() - new Date(r.createdAt).getTime());
            }
        });

        const avgResolutionTimeHours = closedRequests.length > 0
            ? (totalResolutionTime / closedRequests.length / (1000 * 60 * 60)).toFixed(1)
            : 0;

        res.json({
            financials: {
                totalSales: totalSalesValue,
                totalCollected,
                totalOutstanding,
                pendingDues: totalPendingDues,
                overdueDebts,
                inventoryValue: totalInventoryValue,
                customerMachinesCount,
                breakdown
            },
            branchPerformance: branchPerformance.sort((a, b) => b.revenue - a.revenue),
            trends: trendData,
            recentPayments,
            recentRequests,
            metrics: {
                totalRequests,
                closedRequests: closedRequests.length,
                closureRate: totalRequests > 0 ? Math.round((closedRequests.length / totalRequests) * 100) : 0,
                avgResolutionTimeHours
            }
        });

    } catch (error) {
        console.error('Failed to generate executive report:', error);
        res.status(500).json({ error: 'Failed to generate executive report' });
    }
};

router.get('/executive', authenticateToken, requirePermission(PERMISSIONS.ANALYTICS_VIEW_EXECUTIVE), executiveHandler);

/**
 * GET /reports/pos-sales-monthly
 */
router.get('/pos-sales-monthly', authenticateToken, requirePermission(PERMISSIONS.REPORTS_ALL, PERMISSIONS.REPORTS_BRANCH), asyncHandler(async (req, res) => {
    const { from, to, branchId, status, page, pageSize } = req.query;
    const data = await reportService.getPosSalesMonthly({ from, to, branchId, status, page, pageSize }, req);
    res.json(data);
}));

/**
 * GET /reports/pos-sales-daily
 */
router.get('/pos-sales-daily', authenticateToken, requirePermission(PERMISSIONS.REPORTS_ALL, PERMISSIONS.REPORTS_BRANCH), asyncHandler(async (req, res) => {
    const { from, to, branchId, model, segment, agentId, sortBy, page, pageSize } = req.query;
    const data = await reportService.getPosSalesDaily({ from, to, branchId, model, segment, agentId, sortBy, page, pageSize }, req);
    res.json(data);
}));

module.exports = router;
module.exports.executiveHandler = executiveHandler;
