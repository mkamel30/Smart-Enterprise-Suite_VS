/**
 * Dashboard Service
 * 
 * Provides accurate, real-time dashboard metrics from the database.
 * All queries are properly filtered by branch and user permissions.
 * 
 * METRICS REFERENCE:
 * ==================
 * 1. العمليات اليومية (Daily Operations): Count of SystemLog entries for today
 * 2. الفروع النشطة (Active Branches): Count of branches with type='BRANCH' and isActive=true
 * 3. إجمالي المستخدمين (Total Users): Count of User records (filtered by branch for non-admins)
 * 4. الإيرادات الشهرية (Monthly Revenue): Sum of Payment amounts for current month
 * 5. طلبات الصيانة المفتوحة (Open Requests): Count of MaintenanceRequest with status='Open'
 * 6. الأقساط المتأخرة (Overdue Installments): Count of unpaid Installment records past dueDate
 * 7. الماكينات في المخزن (Machines in Warehouse): Count of WarehouseMachine
 * 8. الشرائح في المخزن (SIMs in Warehouse): Count of WarehouseSim
 */

const db = require('../db');

/**
 * Get date boundaries for today
 */
function getTodayBoundaries() {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    return { startOfToday, endOfToday };
}

/**
 * Get date boundaries for current month
 */
function getMonthBoundaries(month = null, year = null) {
    const now = new Date();
    const targetMonth = month !== null ? month : now.getMonth();
    const targetYear = year !== null ? year : now.getFullYear();
    const startOfMonth = new Date(targetYear, targetMonth, 1, 0, 0, 0, 0);
    const endOfMonth = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
    return { startOfMonth, endOfMonth, month: targetMonth, year: targetYear };
}

/**
 * Get date boundaries for current quarter
 */
function getQuarterBoundaries(year = null) {
    const now = new Date();
    const targetYear = year !== null ? year : now.getFullYear();
    const currentQuarter = Math.floor(now.getMonth() / 3);
    const startQuarter = new Date(targetYear, currentQuarter * 3, 1, 0, 0, 0, 0);
    const endQuarter = new Date(targetYear, (currentQuarter + 1) * 3, 0, 23, 59, 59, 999);
    return { startQuarter, endQuarter, quarter: currentQuarter, year: targetYear };
}

/**
 * Get date boundaries for year
 */
function getYearBoundaries(year = null) {
    const now = new Date();
    const targetYear = year !== null ? year : now.getFullYear();
    const startOfYear = new Date(targetYear, 0, 1, 0, 0, 0, 0);
    const endOfYear = new Date(targetYear, 11, 31, 23, 59, 59, 999);
    return { startOfYear, endOfYear, year: targetYear };
}

/**
 * Get period boundaries based on period type
 */
function getPeriodBoundaries(period, options = {}) {
    switch (period) {
        case 'month':
            return getMonthBoundaries(options.month, options.year);
        case 'quarter':
            return getQuarterBoundaries(options.year);
        case 'year':
            return getYearBoundaries(options.year);
        default:
            return getMonthBoundaries();
    }
}


/**
 * Build branch filter based on user role
 * @param {Object} user - Authenticated user object
 * @param {string} targetBranchId - Optional specific branch to filter
 * @returns {Object} Prisma where clause for branchId filtering
 */
function buildBranchFilter(user, targetBranchId = null) {
    const { role, branchId: userBranchId } = user;
    const authorizedIds = user.authorizedBranchIds || (userBranchId ? [userBranchId] : []);

    // Super Admin and Management can see all or filter by specific branch
    if (['SUPER_ADMIN', 'MANAGEMENT'].includes(role)) {
        if (targetBranchId) {
            return { branchId: targetBranchId };
        }
        // Return all data (no branch filter)
        return {};
    }

    // Support hierarchy: filter by authorized branches
    if (authorizedIds.length > 0) {
        if (targetBranchId) {
            // If target provided, ensure it's within authorized branches
            return { branchId: authorizedIds.includes(targetBranchId) ? targetBranchId : 'FORBIDDEN' };
        }
        return { branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds } };
    }

    // Fallback: no data if no branch assigned
    return { branchId: 'NONE' }; // This will match nothing
}

/**
 * Count daily operations (SystemLog entries for today)
 * 
 * Table: SystemLog
 * Filter: createdAt >= startOfToday AND createdAt <= endOfToday
 * Branch: Filtered by user's branch unless admin
 */
async function getDailyOperationsCount(branchFilter) {
    const { startOfToday, endOfToday } = getTodayBoundaries();

    const where = {
        createdAt: { gte: startOfToday, lte: endOfToday },
        ...branchFilter
    };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    return db.systemLog.count({ where });
}

/**
 * Count active branches
 * 
 * Table: Branch
 * Filter: type='BRANCH' AND isActive=true
 * Note: This is a global count, not branch-scoped
 */
async function getActiveBranchesCount() {
    return db.branch.count({
        where: { type: 'BRANCH', isActive: true }
    });
}

/**
 * Count total users
 * 
 * Table: User
 * Filter: For admins - all users; For others - users in same branch
 */
async function getTotalUsersCount(branchFilter) {
    const where = { ...branchFilter };

    // For users count, we generally want all for admins
    if (Object.keys(where).length === 0) {
        // Admin sees all users
        return db.user.count();
    }

    return db.user.count({ where });
}

/**
 * Get monthly revenue (sum of all payments this month)
 * 
 * Table: Payment
 * Filter: createdAt >= startOfMonth AND createdAt <= endOfMonth
 * Aggregation: SUM(amount)
 */
async function getMonthlyRevenue(branchFilter, month = null, year = null) {
    const { startOfMonth, endOfMonth } = getMonthBoundaries(month, year);

    const where = {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        ...branchFilter
    };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    const result = await db.payment.aggregate({
        where,
        _sum: { amount: true }
    });

    return result._sum.amount || 0;
}

/**
 * Get revenue for a specific period
 * 
 * Table: Payment
 * Returns: SUM(amount) for the period
 */
async function getPeriodRevenue(branchFilter, period = 'month', options = {}) {
    const boundaries = getPeriodBoundaries(period, options);

    let startDate, endDate;
    switch (period) {
        case 'month':
            startDate = boundaries.startOfMonth;
            endDate = boundaries.endOfMonth;
            break;
        case 'quarter':
            startDate = boundaries.startQuarter;
            endDate = boundaries.endQuarter;
            break;
        case 'year':
            startDate = boundaries.startOfYear;
            endDate = boundaries.endOfYear;
            break;
        default:
            startDate = boundaries.startOfMonth;
            endDate = boundaries.endOfMonth;
    }

    const where = {
        createdAt: { gte: startDate, lte: endDate },
        ...branchFilter
    };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    const result = await db.payment.aggregate({
        where,
        _sum: { amount: true }
    });

    return {
        amount: result._sum.amount || 0,
        period,
        startDate,
        endDate
    };
}

/**
 * Get weekly revenue trend for current month
 * 
 * Table: Payment
 * Returns: Array of { name: 'W1', value: X } for each week
 */
async function getWeeklyRevenueTrend(branchFilter) {
    const { startOfMonth, endOfMonth } = getMonthBoundaries();

    const where = {
        createdAt: { gte: startOfMonth, lte: endOfMonth },
        ...branchFilter
    };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    const payments = await db.payment.findMany({
        where,
        select: { amount: true, createdAt: true }
    });

    const weeklyRevenue = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

    payments.forEach(p => {
        const day = new Date(p.createdAt).getDate();
        const week = Math.ceil(day / 7);
        if (week >= 1 && week <= 5) {
            weeklyRevenue[week] += (p.amount || 0);
        }
    });

    return [
        { name: 'W1', value: weeklyRevenue[1] },
        { name: 'W2', value: weeklyRevenue[2] },
        { name: 'W3', value: weeklyRevenue[3] },
        { name: 'W4', value: weeklyRevenue[4] + (weeklyRevenue[5] || 0) }
    ];
}

/**
 * Get maintenance request statistics
 * 
 * Table: MaintenanceRequest
 * Returns: { open, inProgress, distribution }
 */
async function getRequestStats(branchFilter) {
    const where = { ...branchFilter };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    const [openCount, inProgressCount, distribution] = await Promise.all([
        db.maintenanceRequest.count({ where: { ...where, status: 'Open' } }),
        db.maintenanceRequest.count({ where: { ...where, status: 'In Progress' } }),
        db.maintenanceRequest.groupBy({
            by: ['status'],
            where,
            _count: { id: true }
        })
    ]);

    return {
        open: openCount,
        inProgress: inProgressCount,
        distribution: distribution.map(s => ({ name: s.status, value: s._count.id }))
    };
}

/**
 * Get overdue installments count
 * 
 * Table: Installment
 * Filter: isPaid=false AND dueDate < today
 */
async function getOverdueInstallmentsCount(branchFilter) {
    const today = new Date();

    const where = {
        isPaid: false,
        dueDate: { lt: today },
        ...branchFilter
    };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    return db.installment.count({ where });
}

/**
 * Get pending installments (due but not paid)
 * 
 * Table: Installment
 * Filter: isPaid=false AND dueDate >= today AND dueDate <= endOfPeriod
 */
async function getPendingInstallments(branchFilter, period = 'month') {
    const today = new Date();
    const { endOfMonth } = getMonthBoundaries();

    const where = {
        isPaid: false,
        dueDate: {
            gte: today,
            lte: period === 'month' ? endOfMonth : today // Current period
        },
        ...branchFilter
    };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    const installments = await db.installment.findMany({
        where,
        orderBy: { dueDate: 'asc' },
        take: 10,
        include: {
            sale: {
                include: {
                    customer: true
                }
            }
        }
    });

    // Calculate totals
    const totals = await db.installment.aggregate({
        where,
        _sum: { amount: true },
        _count: { id: true }
    });

    return {
        installments,
        totalCount: totals._count.id || 0,
        totalAmount: totals._sum.amount || 0,
        totalRemaining: totals._sum.amount || 0
    };
}
/**
 * Get inventory statistics
 * 
 * Tables: WarehouseMachine, WarehouseSim, InventoryItem
 */
async function getInventoryStats(branchFilter) {
    const whereWithBranch = { ...branchFilter };

    // Ensure branchId filter is present for enforcer
    if (!whereWithBranch.branchId) {
        whereWithBranch.branchId = { not: null };
    }

    const [machinesCount, simsCount, lowStockItems] = await Promise.all([
        db.warehouseMachine.count({ where: whereWithBranch }),
        db.warehouseSim.count({ where: whereWithBranch }),
        db.inventoryItem.findMany({
            where: { ...whereWithBranch, quantity: { lte: 5 } },
            include: { part: true },
            take: 5
        })
    ]);

    return {
        machines: machinesCount,
        sims: simsCount,
        lowStock: lowStockItems
    };
}

/**
 * Get pending transfer orders count
 * 
 * Table: TransferOrder
 * Filter: status='PENDING' AND (fromBranchId IN authorizedIds OR toBranchId IN authorizedIds)
 */
async function getPendingTransfersCount(user, isAdmin) {
    if (isAdmin) {
        // Admin sees all pending transfers
        return db.transferOrder.count({
            where: {
                status: 'PENDING',
                branchId: { not: null } // Satisfy branch enforcer
            }
        });
    }

    const authorizedIds = user?.authorizedBranchIds || (user?.branchId ? [user.branchId] : []);
    if (authorizedIds.length === 0) return 0;

    return db.transferOrder.count({
        where: {
            OR: [
                { fromBranchId: { in: authorizedIds } },
                { toBranchId: { in: authorizedIds } }
            ],
            status: 'PENDING',
            branchId: { not: null } // Satisfy branch enforcer
        }
    });
}

/**
 * Get recent payments for activity feed
 * 
 * Table: Payment
 * Returns: Latest 5 payments
 */
async function getRecentPayments(branchFilter) {
    const where = { ...branchFilter };

    // Ensure branchId filter is present for enforcer
    if (!where.branchId) {
        where.branchId = { not: null };
    }

    return db.payment.findMany({
        where,
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            amount: true,
            type: true,
            customerName: true,
            createdAt: true,
            userName: true
        }
    });
}

/**
 * Get branch performance data (for admin dashboard)
 * 
 * Tables: Branch, Payment, MaintenanceRequest
 */
async function getBranchPerformance() {
    const { startOfMonth } = getMonthBoundaries();

    const branches = await db.branch.findMany({
        where: { type: 'BRANCH', isActive: true },
        select: { id: true, name: true }
    });

    const performanceData = await Promise.all(branches.map(async (branch) => {
        const [revenueResult, repairsCount] = await Promise.all([
            db.payment.aggregate({
                where: {
                    branchId: branch.id,
                    createdAt: { gte: startOfMonth }
                },
                _sum: { amount: true }
            }),
            db.maintenanceRequest.count({
                where: {
                    branchId: branch.id,
                    createdAt: { gte: startOfMonth },
                    status: 'Done'
                }
            })
        ]);

        return {
            name: branch.name,
            revenue: revenueResult._sum.amount || 0,
            repairs: repairsCount
        };
    }));

    return performanceData;
}

/**
 * Get admin summary statistics (Super Admin only)
 */
async function getAdminSummary() {
    const { startOfToday } = getTodayBoundaries();
    const { startOfMonth } = getMonthBoundaries();

    const [
        usersCount,
        branchesCount,
        totalMachines,
        dailyOps
    ] = await Promise.all([
        db.user.count(),
        db.branch.count({ where: { type: 'BRANCH', isActive: true } }),
        db.warehouseMachine.count({ where: { branchId: { not: null } } }),
        db.systemLog.count({
            where: {
                createdAt: { gte: startOfToday },
                branchId: { not: null }
            }
        })
    ]);

    const branchPerformance = await getBranchPerformance();

    return {
        usersCount,
        branchesCount,
        totalMachines,
        dailyOps,
        branchPerformance
    };
}

/**
 * Get maintenance performance statistics for a period
 * 
 * Tables: WarehouseMachine, ServiceAssignment, BranchDebt
 */
async function getMaintenanceStats(branchFilter, period = 'month', options = {}) {
    const boundaries = getPeriodBoundaries(period, options);

    let startDate, endDate;
    switch (period) {
        case 'month':
            startDate = boundaries.startOfMonth;
            endDate = boundaries.endOfMonth;
            break;
        case 'quarter':
            startDate = boundaries.startQuarter;
            endDate = boundaries.endQuarter;
            break;
        case 'year':
            startDate = boundaries.startOfYear;
            endDate = boundaries.endOfYear;
            break;
        default:
            startDate = boundaries.startOfMonth;
            endDate = boundaries.endOfMonth;
    }

    // Count completed repairs in period
    const completedRepairs = await db.warehouseMachine.count({
        where: {
            ...branchFilter,
            status: 'REPAIRED',
            updatedAt: { gte: startDate, lte: endDate }
        }
    });

    // Count total loss in period
    const totalLossCount = await db.warehouseMachine.count({
        where: {
            ...branchFilter,
            status: 'TOTAL_LOSS',
            updatedAt: { gte: startDate, lte: endDate }
        }
    });

    // Get maintenance costs (branch debts)
    const maintenanceCosts = await db.branchDebt.aggregate({
        where: {
            ...branchFilter,
            type: 'MAINTENANCE_COST',
            createdAt: { gte: startDate, lte: endDate },
            status: 'PENDING'
        },
        _sum: { amount: true },
        _count: { id: true }
    });

    // Get branch breakdown for admin
    let branchBreakdown = null;
    if (!branchFilter.branchId) {
        const branches = await db.branch.findMany({
            where: { type: 'BRANCH', isActive: true },
            select: { id: true, name: true }
        });

        branchBreakdown = await Promise.all(branches.map(async (branch) => {
            const branchFilterWithId = { branchId: branch.id };
            const [repairs, losses, costs] = await Promise.all([
                db.warehouseMachine.count({
                    where: {
                        ...branchFilterWithId,
                        status: 'REPAIRED',
                        updatedAt: { gte: startDate, lte: endDate }
                    }
                }),
                db.warehouseMachine.count({
                    where: {
                        ...branchFilterWithId,
                        status: 'TOTAL_LOSS',
                        updatedAt: { gte: startDate, lte: endDate }
                    }
                }),
                db.branchDebt.aggregate({
                    where: {
                        ...branchFilterWithId,
                        type: 'MAINTENANCE_COST',
                        createdAt: { gte: startDate, lte: endDate }
                    },
                    _sum: { amount: true }
                })
            ]);

            return {
                branchId: branch.id,
                branchName: branch.name,
                repairs,
                totalLoss: losses,
                totalCost: costs._sum.amount || 0
            };
        }));
    }

    return {
        completedRepairs,
        totalLoss: totalLossCount,
        totalCost: maintenanceCosts._sum.amount || 0,
        costCount: maintenanceCosts._count.id || 0,
        period,
        branchBreakdown
    };
}

/**
 * Get detailed stats for dashboard with period support
 */
async function getDashboardStats(params = {}) {
    const { branchId, period = 'month', month, quarter, year } = params;

    const branchFilter = buildBranchFilter({ role: 'USER', branchId }, branchId);

    const periodOptions = { month, year };
    const periodType = period || 'month';

    const [
        monthlyRevenue,
        weeklyTrend,
        requestStats,
        overdueCount,
        inventoryStats,
        pendingTransfers,
        recentPayments,
        pendingInstallments
    ] = await Promise.all([
        getMonthlyRevenue(branchFilter, month, year),
        getWeeklyRevenueTrend(branchFilter),
        getRequestStats(branchFilter),
        getOverdueInstallmentsCount(branchFilter),
        getInventoryStats(branchFilter),
        getPendingTransfersCount(branchFilter?.branchId, !branchFilter.branchId),
        getRecentPayments(branchFilter),
        getPendingInstallments(branchFilter, periodType)
    ]);

    return {
        revenue: {
            monthly: monthlyRevenue,
            trend: weeklyTrend
        },
        requests: requestStats,
        alerts: {
            overdueInstallments: overdueCount
        },
        inventory: inventoryStats,
        alerts: {
            pendingTransfers: pendingTransfers
        },
        recentActivity: recentPayments,
        pendingInstallments,
        period: {
            type: periodType,
            month,
            year: year || new Date().getFullYear()
        }
    };
}

module.exports = {
    buildBranchFilter,
    getTodayBoundaries,
    getMonthBoundaries,
    getQuarterBoundaries,
    getYearBoundaries,
    getPeriodBoundaries,
    getDailyOperationsCount,
    getActiveBranchesCount,
    getTotalUsersCount,
    getMonthlyRevenue,
    getPeriodRevenue,
    getWeeklyRevenueTrend,
    getRequestStats,
    getOverdueInstallmentsCount,
    getPendingInstallments,
    getInventoryStats,
    getPendingTransfersCount,
    getRecentPayments,
    getBranchPerformance,
    getAdminSummary,
    getMaintenanceStats,
    getDashboardStats
};
