/**
 * Dashboard Routes
 * 
 * Provides accurate, real-time dashboard statistics from the database.
 * All metrics are computed from actual DB queries - no mock data.
 * 
 * METRICS ACCURACY REFERENCE:
 * ===========================
 * | Widget | Table | Filters | Aggregation |
 * |--------|-------|---------|-------------|
 * | العمليات اليومية | SystemLog | createdAt >= today | COUNT |
 * | الفروع النشطة | Branch | type='BRANCH', isActive=true | COUNT |
 * | إجمالي المستخدمين | User | branchId (scoped) | COUNT |
 * | الإيرادات الشهرية | Payment | createdAt in this month | SUM(amount) |
 * | طلبات مفتوحة | MaintenanceRequest | status='Open' | COUNT |
 * | أقساط متأخرة | Installment | isPaid=false, dueDate<today | COUNT |
 * | الماكينات | WarehouseMachine | branchId | COUNT |
 * | الشرائح | WarehouseSim | branchId | COUNT |
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const dashboardService = require('../services/dashboardService');

/**
 * GET /api/dashboard
 * 
 * Main dashboard endpoint - returns all KPIs filtered by user's branch
 * For SUPER_ADMIN/MANAGEMENT: Global view or filtered by ?branchId=X
 * For others: Scoped to their branch
 * 
 * Query params:
 * - branchId: Filter by specific branch (admin only)
 * - period: 'month' | 'quarter' | 'year' (default: 'month')
 * - month: 0-11 (for specific month)
 * - year: YYYY (for specific year)
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const user = req.user;
    const targetBranchId = req.query.branchId;
    const period = req.query.period || 'month';
    const month = req.query.month ? parseInt(req.query.month) : null;
    const year = req.query.year ? parseInt(req.query.year) : new Date().getFullYear();

    // Build branch filter based on user role and optional filter
    const branchFilter = dashboardService.buildBranchFilter(user, targetBranchId);

    // Determine if user is admin (can see global data)
    const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
    const isCenterRole = ['CENTER_MANAGER', 'CENTER_TECH'].includes(user.role);

    // Fetch all metrics in parallel for performance
    const [
        periodRevenue,
        weeklyTrend,
        requestStats,
        inventoryStats,
        overdueInstallments,
        pendingTransfers,
        recentPayments,
        pendingInstallments
    ] = await Promise.all([
        dashboardService.getPeriodRevenue(branchFilter, period, { month, year }),
        dashboardService.getWeeklyRevenueTrend(branchFilter),
        dashboardService.getRequestStats(branchFilter),
        dashboardService.getInventoryStats(branchFilter),
        // Hide installments for center roles
        isCenterRole ? Promise.resolve(0) : dashboardService.getOverdueInstallmentsCount(branchFilter),
        dashboardService.getPendingTransfersCount(user, isAdmin),
        dashboardService.getRecentPayments(branchFilter),
        // Hide installments for center roles
        isCenterRole ? Promise.resolve({ installments: [], totalCount: 0, totalAmount: 0 })
            : dashboardService.getPendingInstallments(branchFilter, period)
    ]);

    res.json({
        revenue: {
            amount: periodRevenue.amount,
            trend: weeklyTrend,
            period: periodRevenue.period
        },
        requests: requestStats,
        inventory: inventoryStats,
        alerts: {
            overdueInstallments: overdueInstallments,
            pendingTransfers: pendingTransfers
        },
        recentActivity: recentPayments,
        pendingInstallments: {
            installments: pendingInstallments.installments,
            totalCount: pendingInstallments.totalCount,
            totalAmount: pendingInstallments.totalAmount,
            totalRemaining: pendingInstallments.totalRemaining
        },
        period: {
            type: period,
            month,
            year
        }
    });
}));

/**
 * GET /api/dashboard/admin-summary
 * 
 * Admin-only endpoint with global statistics
 * Shows: Total users, branches, machines, daily ops, branch performance
 */
router.get('/admin-summary', authenticateToken, asyncHandler(async (req, res) => {
    // Only Super Admin can access this endpoint
    if (req.user.role !== 'SUPER_ADMIN') {
        throw new AppError('صلاحية الوصول مرفوضة: مدير النظام فقط', 403, 'FORBIDDEN');
    }

    const summary = await dashboardService.getAdminSummary();

    // Calculate system health (based on recent logs)
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [totalRecentLogs, errorLogs] = await Promise.all([
        db.systemLog.count({
            where: {
                createdAt: { gte: twentyFourHoursAgo },
                branchId: { not: null }
            }
        }),
        db.systemLog.count({
            where: {
                createdAt: { gte: twentyFourHoursAgo },
                branchId: { not: null },
                OR: [
                    { action: { contains: 'ERROR' } },
                    { details: { contains: 'failed' } },
                    { details: { contains: 'خطأ' } }
                ]
            }
        })
    ]);

    const healthScore = totalRecentLogs > 0
        ? Math.max(0, Math.min(100, 100 - (errorLogs / totalRecentLogs * 100)))
        : 100;

    res.json({
        ...summary,
        systemHealth: {
            score: Math.round(healthScore),
            errorCount: errorLogs,
            totalOps: totalRecentLogs
        }
    });
}));

/**
 * GET /api/dashboard/search
 * 
 * Global search across machines and customers
 * Used by the search bar in the dashboard header
 */
router.get('/search', authenticateToken, asyncHandler(async (req, res) => {
    const { q } = req.query;
    if (!q || q.length < 2) {
        return res.json({ machines: [], customers: [] });
    }

    const branchFilter = getBranchFilter(req);

    // Ensure branchId filter is present
    const whereBase = { ...branchFilter };
    if (!whereBase.branchId) {
        whereBase.branchId = { not: null };
    }

    // Search in parallel
    const [machines, customers] = await Promise.all([
        // Search machines by serial number
        db.warehouseMachine.findMany({
            where: {
                ...whereBase,
                serialNumber: { contains: q }
            },
            take: 10,
            select: {
                id: true,
                serialNumber: true,
                model: true,
                status: true,
                branch: { select: { name: true } }
            }
        }),
        // Search customers by BK code or name
        db.customer.findMany({
            where: {
                ...whereBase,
                OR: [
                    { bkcode: { contains: q } },
                    { client_name: { contains: q } }
                ]
            },
            take: 10,
            select: {
                id: true,
                bkcode: true,
                client_name: true,
                branch: { select: { name: true } }
            }
        })
    ]);

    res.json({
        machines: machines.map(m => ({ ...m, type: 'MACHINE' })),
        customers: customers.map(c => ({ ...c, type: 'CUSTOMER' }))
    });
}));

/**
 * GET /api/dashboard/metrics-reference
 * 
 * Debug endpoint - returns documentation of how each metric is calculated
 * Useful for verifying data accuracy
 */
router.get('/metrics-reference', authenticateToken, asyncHandler(async (req, res) => {
    res.json({
        metrics: [
            {
                name: 'العمليات اليومية (Daily Operations)',
                table: 'SystemLog',
                filter: 'createdAt >= startOfToday AND branchId is not null',
                aggregation: 'COUNT(*)',
                notes: 'Counts all system log entries for today'
            },
            {
                name: 'الفروع النشطة (Active Branches)',
                table: 'Branch',
                filter: "type='BRANCH' AND isActive=true",
                aggregation: 'COUNT(*)',
                notes: 'Global count, not branch-scoped'
            },
            {
                name: 'إجمالي المستخدمين (Total Users)',
                table: 'User',
                filter: 'branchId (scoped by role)',
                aggregation: 'COUNT(*)',
                notes: 'Admins see all, others see their branch only'
            },
            {
                name: 'الإيرادات الشهرية (Monthly Revenue)',
                table: 'Payment',
                filter: 'createdAt >= startOfMonth AND createdAt <= endOfMonth',
                aggregation: 'SUM(amount)',
                notes: 'Sum of all payment amounts for current month'
            },
            {
                name: 'طلبات الصيانة المفتوحة (Open Requests)',
                table: 'MaintenanceRequest',
                filter: "status='Open'",
                aggregation: 'COUNT(*)',
                notes: 'Filtered by branch for non-admins'
            },
            {
                name: 'الأقساط المتأخرة (Overdue Installments)',
                table: 'Installment',
                filter: 'isPaid=false AND dueDate < today',
                aggregation: 'COUNT(*)',
                notes: 'Hidden for maintenance center roles'
            },
            {
                name: 'الماكينات في المخزن (Warehouse Machines)',
                table: 'WarehouseMachine',
                filter: 'branchId',
                aggregation: 'COUNT(*)',
                notes: 'Count of machines in warehouse'
            },
            {
                name: 'الشرائح في المخزن (Warehouse SIMs)',
                table: 'WarehouseSim',
                filter: 'branchId',
                aggregation: 'COUNT(*)',
                notes: 'Count of SIMs in warehouse'
            }
        ],
        generated: new Date().toISOString()
    });
}));

module.exports = router;
