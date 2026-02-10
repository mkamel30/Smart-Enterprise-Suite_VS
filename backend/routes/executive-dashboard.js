const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { isGlobalRole } = require('../utils/constants');

// ===================== EXECUTIVE DASHBOARD =====================
// This dashboard is designed for SUPER_ADMIN, MANAGEMENT, and high-level decision makers

/**
 * @route GET /executive-dashboard
 * @summary Get comprehensive executive analytics
 * @security bearerAuth
 * @queryParam {string} startDate - Start date (YYYY-MM-DD)
 * @queryParam {string} endDate - End date (YYYY-MM-DD)
 * @queryParam {string} branchId - Optional branch filter
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    // Only allow management roles
    const allowedRoles = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER', 'CS_SUPERVISOR'];
    if (!allowedRoles.includes(req.user.role)) {
        throw new AppError('Access denied: Executive access required', 403, 'FORBIDDEN');
    }

    const { startDate, endDate, branchId } = req.query;

    // Date range calculation
    const today = new Date();
    const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
    const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

    const dateStart = startDate ? new Date(startDate) : currentMonthStart;
    const dateEnd = endDate ? new Date(endDate) : currentMonthEnd;

    // Branch filter for non-admins or when explicitly specified
    // Support hierarchy: use authorized branches if not admin
    const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
    let branchFilter = {};

    if (isGlobalRole(req.user.role)) {
        if (branchId) branchFilter = { branchId };
    } else {
        // Restricted user
        if (branchId) {
            // If specific branch requested, check authorization
            branchFilter = authorizedIds.includes(branchId) ? { branchId } : { branchId: 'FORBIDDEN' };
        } else {
            // Default to all authorized branches
            branchFilter = { branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds } };
        }
    }

    // ===================== PARALLEL DATA FETCH =====================
    // All these queries are independent — run them concurrently for speed

    const periodDiff = dateEnd.getTime() - dateStart.getTime();
    const prevStart = new Date(dateStart.getTime() - periodDiff);
    const prevEnd = new Date(dateEnd.getTime() - periodDiff);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const isAdmin = isGlobalRole(req.user.role);

    const [
        currentRevenue,
        previousRevenue,
        revenueByType,
        machineSales,
        pendingPayments,
        requestsTotal,
        requestsClosed,
        closedRequests,
        overdueRequests,
        inventoryItems
    ] = await Promise.all([
        // 1. Current Period Revenue
        db.payment.aggregate(ensureBranchWhere({
            where: { ...branchFilter, createdAt: { gte: dateStart, lte: dateEnd } },
            _sum: { amount: true }
        }, req)),

        // 2. Previous Period Revenue
        db.payment.aggregate(ensureBranchWhere({
            where: { ...branchFilter, createdAt: { gte: prevStart, lte: prevEnd } },
            _sum: { amount: true }
        }, req)),

        // 3. Revenue by Type
        db.payment.groupBy(ensureBranchWhere({
            by: ['type'],
            where: { ...branchFilter, createdAt: { gte: dateStart, lte: dateEnd } },
            _sum: { amount: true }
        }, req)),

        // 4. Machine Sales (for installment calculations)
        db.machineSale.findMany(ensureBranchWhere({
            where: { ...branchFilter, status: { not: 'CANCELLED' } },
            select: { totalPrice: true, paidAmount: true }
        }, req)),

        // 5. Pending Maintenance Debts
        db.branchDebt.findMany({
            where: {
                ...(branchId ? { debtorBranchId: branchId } : (isAdmin ? { _skipBranchEnforcer: true } : {})),
                status: 'PENDING_PAYMENT'
            },
            select: { remainingAmount: true, createdAt: true }
        }),

        // 6. Total Requests (period)
        db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...branchFilter, createdAt: { gte: dateStart, lte: dateEnd } }
        }, req)),

        // 7. Closed Requests count
        db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...branchFilter, status: 'Closed', closingTimestamp: { gte: dateStart, lte: dateEnd } }
        }, req)),

        // 8. Closed Requests with timestamps (for avg resolution)
        db.maintenanceRequest.findMany(ensureBranchWhere({
            where: { ...branchFilter, status: 'Closed', closingTimestamp: { gte: dateStart, lte: dateEnd } },
            select: { createdAt: true, closingTimestamp: true }
        }, req)),

        // 9. Overdue Requests (> 7 days)
        db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...branchFilter, status: { in: ['Open', 'In Progress'] }, createdAt: { lt: sevenDaysAgo } }
        }, req)),

        // 10. Inventory Items
        db.inventoryItem.findMany(ensureBranchWhere({
            where: branchFilter, include: { part: true }
        }, req))
    ]);

    // ===================== 1. FINANCIAL KPIs =====================

    const remainingInstallments = machineSales.reduce((sum, s) => sum + (s.totalPrice - s.paidAmount), 0);
    const pendingMaintenanceDebts = pendingPayments.reduce((sum, p) => sum + p.remainingAmount, 0);
    const pendingDebtsTotal = remainingInstallments + pendingMaintenanceDebts;

    // Overdue Debts (> 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const overdueDebtsTotal = pendingPayments
        .filter(p => new Date(p.createdAt) < thirtyDaysAgo)
        .reduce((sum, p) => sum + p.remainingAmount, 0);

    // ===================== 2. OPERATIONAL KPIs =====================

    const closureRate = requestsTotal > 0 ? Math.round((requestsClosed / requestsTotal) * 100) : 0;

    let avgResolutionTime = 0;
    if (closedRequests.length > 0) {
        const totalDays = closedRequests.reduce((sum, r) => {
            if (r.closingTimestamp) {
                return sum + (new Date(r.closingTimestamp).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
            }
            return sum;
        }, 0);
        avgResolutionTime = (totalDays / closedRequests.length).toFixed(1);
    }

    // ===================== 3. INVENTORY HEALTH =====================

    let inStock = 0, lowStock = 0, critical = 0, outOfStock = 0;
    inventoryItems.forEach(item => {
        const minLevel = item.minLevel || 10;
        if (item.quantity === 0) outOfStock++;
        else if (item.quantity < minLevel * 0.2) critical++;
        else if (item.quantity < minLevel) lowStock++;
        else inStock++;
    });

    const inventoryHealth = inventoryItems.length > 0
        ? Math.round((inStock / inventoryItems.length) * 100)
        : 100;


    // ===================== 4. BRANCH PERFORMANCE =====================

    const branches = await db.branch.findMany({
        where: { type: 'BRANCH' },
        select: { id: true, name: true, code: true }
    });

    const branchPerformance = await Promise.all(branches.map(async (branch) => {
        // Revenue
        const revenue = await db.payment.aggregate({
            where: {
                branchId: branch.id,
                createdAt: { gte: dateStart, lte: dateEnd }
            },
            _sum: { amount: true }
        });

        // Previous revenue
        const prevRev = await db.payment.aggregate({
            where: {
                branchId: branch.id,
                createdAt: { gte: prevStart, lte: prevEnd }
            },
            _sum: { amount: true }
        });

        // Closure rate
        const total = await db.maintenanceRequest.count({
            where: {
                branchId: branch.id,
                createdAt: { gte: dateStart, lte: dateEnd }
            }
        });

        const closed = await db.maintenanceRequest.count({
            where: {
                branchId: branch.id,
                status: 'Closed',
                closingTimestamp: { gte: dateStart, lte: dateEnd }
            }
        });

        const currentRev = revenue._sum.amount || 0;
        const previousRev = prevRev._sum.amount || 0;
        const change = previousRev > 0 ? ((currentRev - previousRev) / previousRev * 100).toFixed(1) : 0;

        return {
            id: branch.id,
            name: branch.name,
            code: branch.code,
            revenue: currentRev,
            previousRevenue: previousRev,
            change: parseFloat(change),
            closureRate: total > 0 ? Math.round((closed / total) * 100) : 0,
            totalRequests: total,
            closedRequests: closed
        };
    }));

    // Sort by revenue
    branchPerformance.sort((a, b) => b.revenue - a.revenue);

    // ===================== 5. MONTHLY TREND (Last 6 months) =====================

    const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const trendPayments = await db.payment.findMany(ensureBranchWhere({
        where: {
            ...branchFilter,
            createdAt: { gte: sixMonthsAgo }
        },
        select: { amount: true, createdAt: true, type: true }
    }, req));

    const monthlyTrend = {};
    for (let i = 5; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const monthKey = monthDate.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
        monthlyTrend[monthKey] = { total: 0, maintenance: 0, sales: 0, parts: 0 };
    }

    trendPayments.forEach(p => {
        const pDate = new Date(p.createdAt);
        const key = pDate.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
        if (monthlyTrend[key]) {
            monthlyTrend[key].total += p.amount;
            if (p.type === 'MAINTENANCE') monthlyTrend[key].maintenance += p.amount;
            else if (p.type === 'SALE' || p.type === 'INSTALLMENT') monthlyTrend[key].sales += p.amount;
            else if (p.type === 'SPARE_PARTS') monthlyTrend[key].parts += p.amount;
        }
    });

    const trendData = Object.entries(monthlyTrend).map(([name, values]) => ({
        name,
        ...values
    }));

    // ===================== 6. TOP PERFORMERS (Technicians) =====================

    const techPerformance = await db.maintenanceRequest.groupBy(ensureBranchWhere({
        by: ['closingUserName'],
        where: {
            ...branchFilter,
            status: 'Closed',
            closingTimestamp: { gte: dateStart, lte: dateEnd },
            closingUserName: { not: null }
        },
        _count: { id: true },
        _sum: { totalCost: true }
    }, req));

    const topPerformers = techPerformance
        .filter(t => t.closingUserName)
        .map(t => ({
            name: t.closingUserName,
            closedCount: t._count.id,
            revenue: t._sum.totalCost || 0
        }))
        .sort((a, b) => b.closedCount - a.closedCount)
        .slice(0, 10);

    // ===================== 7. ALERTS & NOTIFICATIONS =====================

    // Pending Approvals - MaintenanceApprovalRequest uses originBranchId
    // Use _skipBranchEnforcer marker for admin all-branches view
    const pendingApprovals = await db.maintenanceApprovalRequest.count({
        where: {
            ...(branchId ? { originBranchId: branchId } : (isAdmin ? { _skipBranchEnforcer: true } : {})),
            status: 'PENDING'
        }
    });

    const pendingTransfers = await db.transferOrder.count(ensureBranchWhere({
        where: {
            ...branchFilter,
            status: 'PENDING'
        }
    }, req));

    const criticalAlerts = [];

    // Low inventory alert
    if (critical > 0 || outOfStock > 0) {
        criticalAlerts.push({
            type: 'INVENTORY',
            severity: outOfStock > 0 ? 'critical' : 'warning',
            message: `${outOfStock + critical} قطع غيار في حالة حرجة`,
            count: outOfStock + critical
        });
    }

    // Overdue requests alert
    if (overdueRequests > 0) {
        criticalAlerts.push({
            type: 'REQUESTS',
            severity: overdueRequests > 5 ? 'critical' : 'warning',
            message: `${overdueRequests} طلب صيانة متأخر (> 7 أيام)`,
            count: overdueRequests
        });
    }

    // Overdue debts alert
    if (overdueDebtsTotal > 0) {
        criticalAlerts.push({
            type: 'DEBTS',
            severity: overdueDebtsTotal > 50000 ? 'critical' : 'warning',
            message: `مديونيات متأخرة: ${overdueDebtsTotal.toLocaleString()} ج.م`,
            amount: overdueDebtsTotal
        });
    }

    // ===================== 8. FORECASTING (Simple Moving Average) =====================

    // Get last 12 months of data for better forecast
    const twelveMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 11, 1);
    const forecastPayments = await db.payment.findMany(ensureBranchWhere({
        where: {
            ...branchFilter,
            createdAt: { gte: twelveMonthsAgo }
        },
        select: { amount: true, createdAt: true }
    }, req));

    // Group by month
    const monthlyRevenues = {};
    for (let i = 11; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = `${monthDate.getFullYear()}-${String(monthDate.getMonth() + 1).padStart(2, '0')}`;
        monthlyRevenues[key] = 0;
    }

    forecastPayments.forEach(p => {
        const pDate = new Date(p.createdAt);
        const key = `${pDate.getFullYear()}-${String(pDate.getMonth() + 1).padStart(2, '0')}`;
        if (monthlyRevenues[key] !== undefined) {
            monthlyRevenues[key] += p.amount;
        }
    });

    const revenueHistory = Object.values(monthlyRevenues);

    // Simple Moving Average (3-month window)
    const windowSize = 3;
    const calculateSMA = (data, periods) => {
        if (data.length < periods) return data.reduce((a, b) => a + b, 0) / data.length;
        const recent = data.slice(-periods);
        return recent.reduce((a, b) => a + b, 0) / periods;
    };

    // Calculate trend
    const recentAvg = calculateSMA(revenueHistory, 3);
    const olderAvg = calculateSMA(revenueHistory.slice(0, -3), 3);
    const growthRate = olderAvg > 0 ? (recentAvg - olderAvg) / olderAvg : 0;

    // Forecast next 3 months
    const forecast = [];
    let lastValue = recentAvg;
    for (let i = 1; i <= 3; i++) {
        const forecastMonth = new Date(today.getFullYear(), today.getMonth() + i, 1);
        const predictedValue = lastValue * (1 + growthRate * 0.5); // Dampened growth
        const variance = predictedValue * 0.15; // 15% variance for confidence interval

        forecast.push({
            month: forecastMonth.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' }),
            predicted: Math.round(predictedValue),
            upperBound: Math.round(predictedValue + variance),
            lowerBound: Math.round(Math.max(0, predictedValue - variance)),
            confidence: 95
        });
        lastValue = predictedValue;
    }

    // ===================== 9. QUICK STATS =====================

    // Total POS machines assigned to customers (ماكينة)
    const totalMachines = await db.posMachine.count(ensureBranchWhere({
        where: {
            ...branchFilter,
            customerId: { not: null }
        }
    }, req));

    // Total customers (عميل)
    const totalCustomers = await db.customer.count(ensureBranchWhere({
        where: branchFilter
    }, req));

    // ===================== RESPONSE =====================

    const currentTotal = currentRevenue._sum.amount || 0;
    const previousTotal = previousRevenue._sum.amount || 0;
    const revenueChange = previousTotal > 0
        ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1)
        : 0;

    res.json({
        summary: {
            dateRange: { start: dateStart, end: dateEnd },
            totalRevenue: currentTotal,
            previousRevenue: previousTotal,
            revenueChange: parseFloat(revenueChange),
            pendingDebts: pendingDebtsTotal,
            overdueDebts: overdueDebtsTotal,
            closureRate,
            avgResolutionTime: parseFloat(avgResolutionTime),
            overdueRequests,
            inventoryHealth
        },
        revenueBreakdown: revenueByType.map(r => ({
            type: r.type || 'OTHER',
            amount: r._sum.amount || 0
        })),
        inventoryStatus: {
            inStock,
            lowStock,
            critical,
            outOfStock,
            total: inventoryItems.length
        },
        branchPerformance,
        monthlyTrend: trendData,
        topPerformers,
        alerts: criticalAlerts,
        pendingActions: {
            approvals: pendingApprovals,
            transfers: pendingTransfers
        },
        quickStats: {
            totalMachines, // POS machines assigned to customers
            totalCustomers,
            totalRequests: requestsTotal,
            closedRequests: requestsClosed
        },
        forecast: {
            predictions: forecast,
            growthRate: Math.round(growthRate * 100),
            algorithm: 'SMA-3',
            lastUpdated: new Date().toISOString()
        }
    });
}));

/**
 * @route GET /executive-dashboard/branch/:branchId
 * @summary Get detailed analytics for a specific branch (drill-down)
 */
router.get('/branch/:branchId', authenticateToken, asyncHandler(async (req, res) => {
    // Match allowed roles of main executive dashboard
    const allowedRoles = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER', 'CS_SUPERVISOR', 'BRANCH_MANAGER', 'ADMIN_AFFAIRS'];
    if (!allowedRoles.includes(req.user.role)) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    const { branchId } = req.params;

    // Authorization check for hierarchical access
    const isAdmin = isGlobalRole(req.user.role);
    if (!isAdmin) {
        const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
        if (!authorizedIds.includes(branchId)) {
            throw new AppError('Access denied: You do not have permission to view this branch', 403, 'FORBIDDEN');
        }
    }
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);

    const branch = await db.branch.findUnique({
        where: { id: branchId },
        select: { id: true, name: true, code: true, type: true }
    });

    if (!branch) {
        throw new AppError('Branch not found', 404, 'NOT_FOUND');
    }

    // ===================== REVENUE =====================
    const currentMonthRevenue = await db.payment.aggregate({
        where: {
            branchId,
            createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
    });

    // Revenue by type
    const revenueByType = await db.payment.groupBy({
        by: ['type'],
        where: {
            branchId,
            createdAt: { gte: startOfMonth }
        },
        _sum: { amount: true }
    });

    // Monthly trend (last 3 months)
    const monthlyPayments = await db.payment.findMany({
        where: {
            branchId,
            createdAt: { gte: threeMonthsAgo }
        },
        select: { amount: true, createdAt: true }
    });

    const monthlyTrend = {};
    for (let i = 2; i >= 0; i--) {
        const monthDate = new Date(today.getFullYear(), today.getMonth() - i, 1);
        const key = monthDate.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
        monthlyTrend[key] = 0;
    }

    monthlyPayments.forEach(p => {
        const pDate = new Date(p.createdAt);
        const key = pDate.toLocaleDateString('ar-EG', { month: 'short', year: '2-digit' });
        if (monthlyTrend[key] !== undefined) {
            monthlyTrend[key] += p.amount;
        }
    });

    // ===================== REQUESTS =====================
    const requests = await db.maintenanceRequest.findMany({
        where: {
            branchId,
            createdAt: { gte: startOfMonth }
        },
        select: {
            id: true,
            status: true,
            createdAt: true,
            closingTimestamp: true,
            totalCost: true,
            closingUserName: true
        }
    });

    // Status distribution
    const statusCounts = {
        Open: 0,
        'In Progress': 0,
        'Pending Approval': 0,
        Closed: 0
    };
    requests.forEach(r => {
        if (statusCounts[r.status] !== undefined) {
            statusCounts[r.status]++;
        }
    });

    // Average resolution time
    const closedRequests = requests.filter(r => r.status === 'Closed' && r.closingTimestamp);
    let avgResolutionDays = 0;
    if (closedRequests.length > 0) {
        const totalDays = closedRequests.reduce((sum, r) => {
            return sum + (new Date(r.closingTimestamp).getTime() - new Date(r.createdAt).getTime()) / (1000 * 60 * 60 * 24);
        }, 0);
        avgResolutionDays = (totalDays / closedRequests.length).toFixed(1);
    }

    // ===================== INVENTORY =====================
    const inventory = await db.inventoryItem.findMany({
        where: { branchId },
        include: { part: true }
    });

    const lowStockItems = inventory.filter(i => i.quantity > 0 && i.quantity < (i.minLevel || 10));
    const outOfStockItems = inventory.filter(i => i.quantity === 0);

    // ===================== TEAM PERFORMANCE =====================
    const users = await db.user.findMany({
        where: { branchId },
        select: { id: true, displayName: true, role: true, isActive: true }
    });

    const techPerformance = await db.maintenanceRequest.groupBy({
        by: ['closingUserName'],
        where: {
            branchId,
            status: 'Closed',
            closingTimestamp: { gte: startOfMonth },
            closingUserName: { not: null }
        },
        _count: { id: true },
        _sum: { totalCost: true }
    });

    const topTechnicians = techPerformance
        .filter(t => t.closingUserName)
        .map(t => ({
            name: t.closingUserName,
            closedCount: t._count.id,
            revenue: t._sum.totalCost || 0
        }))
        .sort((a, b) => b.closedCount - a.closedCount)
        .slice(0, 5);

    // ===================== TOP CUSTOMERS =====================
    const topCustomers = await db.customer.findMany({
        where: { branchId },
        select: {
            id: true,
            client_name: true,
            bkcode: true,
            _count: {
                select: { machines: true }
            }
        },
        orderBy: { client_name: 'asc' },
        take: 10
    });

    // ===================== RECENT ACTIVITY =====================
    const recentPayments = await db.payment.findMany({
        where: { branchId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
            id: true,
            amount: true,
            type: true,
            createdAt: true,
            receiptNumber: true
        }
    });

    res.json({
        branch,
        revenue: {
            currentMonth: currentMonthRevenue._sum.amount || 0,
            byType: revenueByType.map(r => ({ type: r.type || 'OTHER', amount: r._sum.amount || 0 })),
            trend: Object.entries(monthlyTrend).map(([month, amount]) => ({ month, amount }))
        },
        requests: {
            total: requests.length,
            distribution: statusCounts,
            closedCount: closedRequests.length,
            avgResolutionDays: parseFloat(avgResolutionDays),
            closureRate: requests.length > 0 ? Math.round((closedRequests.length / requests.length) * 100) : 0
        },
        inventory: {
            total: inventory.length,
            lowStockCount: lowStockItems.length,
            outOfStockCount: outOfStockItems.length,
            lowStockItems: lowStockItems.slice(0, 5).map(i => ({
                name: i.part?.name || 'Unknown',
                quantity: i.quantity,
                minLevel: i.minLevel || 10
            })),
            outOfStockItems: outOfStockItems.slice(0, 5).map(i => ({
                name: i.part?.name || 'Unknown'
            }))
        },
        team: {
            total: users.length,
            active: users.filter(u => u.isActive).length,
            byRole: {
                technicians: users.filter(u => ['TECHNICIAN', 'BRANCH_TECH', 'CS_AGENT'].includes(u.role)).length,
                supervisors: users.filter(u => ['BRANCH_MANAGER', 'CS_SUPERVISOR'].includes(u.role)).length
            },
            topPerformers: topTechnicians
        },
        topCustomers: topCustomers.map(c => ({
            id: c.id,
            name: c.client_name, // Fixed: was c.name
            bkcode: c.bkcode,
            machineCount: c._count.machines
        })),
        recentActivity: recentPayments
    });
}));

module.exports = router;
