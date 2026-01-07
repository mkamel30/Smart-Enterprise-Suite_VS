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
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const dashboardService = require('../services/dashboardService');

/**
 * GET /api/dashboard
 * 
 * Main dashboard endpoint - returns all KPIs filtered by user's branch
 * For SUPER_ADMIN/MANAGEMENT: Global view or filtered by ?branchId=X
 * For others: Scoped to their branch
 */
router.get('/', authenticateToken, async (req, res) => {
    try {
        const user = req.user;
        const targetBranchId = req.query.branchId;

        // Build branch filter based on user role and optional filter
        const branchFilter = dashboardService.buildBranchFilter(user, targetBranchId);

        // Determine if user is admin (can see global data)
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
        const isCenterRole = ['CENTER_MANAGER', 'CENTER_TECH'].includes(user.role);

        // Fetch all metrics in parallel for performance
        const [
            monthlyRevenue,
            weeklyTrend,
            requestStats,
            inventoryStats,
            overdueInstallments,
            pendingTransfers,
            recentPayments
        ] = await Promise.all([
            dashboardService.getMonthlyRevenue(branchFilter),
            dashboardService.getWeeklyRevenueTrend(branchFilter),
            dashboardService.getRequestStats(branchFilter),
            dashboardService.getInventoryStats(branchFilter),
            // Hide installments for center roles
            isCenterRole ? Promise.resolve(0) : dashboardService.getOverdueInstallmentsCount(branchFilter),
            dashboardService.getPendingTransfersCount(user.branchId, isAdmin),
            dashboardService.getRecentPayments(branchFilter)
        ]);

        res.json({
            revenue: {
                monthly: monthlyRevenue,
                trend: weeklyTrend
            },
            requests: requestStats,
            inventory: inventoryStats,
            alerts: {
                overdueInstallments: overdueInstallments,
                pendingTransfers: pendingTransfers
            },
            recentActivity: recentPayments
        });

    } catch (error) {
        console.error('Dashboard error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'فشل في تحميل بيانات لوحة التحكم',
            details: error.message
        });
    }
});

/**
 * GET /api/dashboard/admin-summary
 * 
 * Admin-only endpoint with global statistics
 * Shows: Total users, branches, machines, daily ops, branch performance
 */
router.get('/admin-summary', authenticateToken, async (req, res) => {
    // Only Super Admin can access this endpoint
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'صلاحية الوصول مرفوضة: مدير النظام فقط' });
    }

    try {
        const summary = await dashboardService.getAdminSummary();

        // Calculate system health (based on recent logs)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const db = require('../db');

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

    } catch (error) {
        console.error('Admin summary error:', error);
        console.error('Error stack:', error.stack);
        res.status(500).json({
            error: 'فشل في تحميل ملخص الإدارة',
            details: error.message
        });
    }
});

/**
 * GET /api/dashboard/search
 * 
 * Global search across machines and customers
 * Used by the search bar in the dashboard header
 */
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ machines: [], customers: [] });
        }

        const branchFilter = getBranchFilter(req);
        const db = require('../db');

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

    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'فشل في البحث' });
    }
});

/**
 * GET /api/dashboard/metrics-reference
 * 
 * Debug endpoint - returns documentation of how each metric is calculated
 * Useful for verifying data accuracy
 */
router.get('/metrics-reference', authenticateToken, async (req, res) => {
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
});

module.exports = router;
