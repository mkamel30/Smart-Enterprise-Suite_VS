/**
 * Executive Dashboard Metrics Cache Service
 * 
 * This service pre-calculates and caches dashboard metrics to improve
 * performance for the executive dashboard. Runs on a schedule.
 */

const db = require('../db');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

// In-memory cache (for single-instance deployments)
let metricsCache = {
    lastUpdated: null,
    data: null,
    branchData: {}
};

// Cache TTL: 5 minutes
const CACHE_TTL = 5 * 60 * 1000;

/**
 * Get cached metrics if available and fresh
 */
function getCachedMetrics() {
    if (!metricsCache.lastUpdated) return null;

    const age = Date.now() - new Date(metricsCache.lastUpdated).getTime();
    if (age > CACHE_TTL) return null;

    return metricsCache.data;
}

/**
 * Get cached branch metrics
 */
function getCachedBranchMetrics(branchId) {
    const cachedBranch = metricsCache.branchData[branchId];
    if (!cachedBranch) return null;

    const age = Date.now() - new Date(cachedBranch.lastUpdated).getTime();
    if (age > CACHE_TTL) return null;

    return cachedBranch.data;
}

/**
 * Pre-calculate all dashboard metrics
 */
async function calculateAllMetrics() {
    console.log('[MetricsCache] Starting metrics calculation...');
    const startTime = Date.now();

    try {
        const today = new Date();
        const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);
        const currentMonthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const lastMonthStart = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthEnd = new Date(today.getFullYear(), today.getMonth(), 0);

        // ===================== FINANCIAL METRICS =====================

        const [currentRevenue, previousRevenue, pendingDebts, overdueDebts] = await Promise.all([
            db.payment.aggregate({
                where: {
                    createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
                    branchId: { not: null }
                },
                _sum: { amount: true }
            }),
            db.payment.aggregate({
                where: {
                    createdAt: { gte: lastMonthStart, lte: lastMonthEnd },
                    branchId: { not: null }
                },
                _sum: { amount: true }
            }),
            db.branchDebt.aggregate({
                where: {
                    status: 'PENDING_PAYMENT',
                    debtorBranchId: { not: '' }
                },
                _sum: { amount: true }
            }),
            db.branchDebt.aggregate({
                where: {
                    status: 'PENDING_PAYMENT',
                    createdAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
                    debtorBranchId: { not: '' }
                },
                _sum: { amount: true }
            })
        ]);

        // ===================== OPERATIONAL METRICS =====================

        const [totalRequests, closedRequests, overdueRequests] = await Promise.all([
            db.maintenanceRequest.count({
                where: {
                    createdAt: { gte: currentMonthStart, lte: currentMonthEnd },
                    branchId: { not: null }
                }
            }),
            db.maintenanceRequest.count({
                where: {
                    status: 'Closed',
                    closingTimestamp: { gte: currentMonthStart, lte: currentMonthEnd },
                    branchId: { not: null }
                }
            }),
            db.maintenanceRequest.count({
                where: {
                    status: { in: ['Open', 'In Progress'] },
                    createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
                    branchId: { not: null }
                }
            })
        ]);

        // ===================== INVENTORY HEALTH =====================

        const inventoryItems = await db.inventoryItem.findMany({
            where: { branchId: { not: null } },
            select: { quantity: true, minLevel: true }
        });

        let inStock = 0, lowStock = 0, critical = 0, outOfStock = 0;
        inventoryItems.forEach(item => {
            const minLevel = item.minLevel || 10;
            if (item.quantity === 0) outOfStock++;
            else if (item.quantity < minLevel * 0.2) critical++;
            else if (item.quantity < minLevel) lowStock++;
            else inStock++;
        });

        // ===================== BRANCH SUMMARY =====================

        const branches = await db.branch.findMany({
            where: { type: 'BRANCH' },
            select: { id: true, name: true, code: true }
        });

        const branchSummary = await Promise.all(branches.map(async (branch) => {
            const revenue = await db.payment.aggregate({
                where: {
                    branchId: branch.id,
                    createdAt: { gte: currentMonthStart, lte: currentMonthEnd }
                },
                _sum: { amount: true }
            });

            return {
                id: branch.id,
                name: branch.name,
                code: branch.code,
                revenue: revenue._sum.amount || 0
            };
        }));

        branchSummary.sort((a, b) => b.revenue - a.revenue);

        // ===================== QUICK COUNTS =====================

        const [totalMachines, totalCustomers, pendingApprovals, pendingTransfers] = await Promise.all([
            db.warehouseMachine.count({ where: { branchId: { not: null } } }),
            db.customer.count({ where: { branchId: { not: null } } }),
            db.maintenanceApprovalRequest.count({
                where: {
                    status: 'PENDING',
                    centerBranchId: { not: '' }
                }
            }),
            db.transferOrder.count({
                where: {
                    status: 'PENDING',
                    branchId: { not: null }
                }
            })
        ]);

        // ===================== COMPILE RESULTS =====================

        const currentTotal = currentRevenue._sum.amount || 0;
        const previousTotal = previousRevenue._sum.amount || 0;
        const revenueChange = previousTotal > 0
            ? ((currentTotal - previousTotal) / previousTotal * 100).toFixed(1)
            : 0;
        const closureRate = totalRequests > 0 ? Math.round((closedRequests / totalRequests) * 100) : 0;
        const inventoryHealth = inventoryItems.length > 0
            ? Math.round((inStock / inventoryItems.length) * 100)
            : 100;

        const metrics = {
            summary: {
                totalRevenue: currentTotal,
                previousRevenue: previousTotal,
                revenueChange: parseFloat(revenueChange),
                pendingDebts: pendingDebts._sum.amount || 0,
                overdueDebts: overdueDebts._sum.amount || 0,
                closureRate,
                overdueRequests,
                inventoryHealth
            },
            inventoryStatus: {
                inStock,
                lowStock,
                critical,
                outOfStock,
                total: inventoryItems.length
            },
            branchSummary: branchSummary.slice(0, 10),
            quickCounts: {
                totalMachines,
                totalCustomers,
                pendingApprovals,
                pendingTransfers,
                totalRequests,
                closedRequests
            },
            lastUpdated: new Date().toISOString()
        };

        // Update cache
        metricsCache = {
            lastUpdated: metrics.lastUpdated,
            data: metrics,
            branchData: metricsCache.branchData // Preserve branch-specific cache
        };

        const duration = Date.now() - startTime;
        console.log(`[MetricsCache] Metrics calculated in ${duration}ms`);

        return metrics;

    } catch (error) {
        console.error('[MetricsCache] Error calculating metrics:', error);
        throw error;
    }
}

/**
 * Pre-calculate metrics for a specific branch
 */
async function calculateBranchMetrics(branchId) {
    console.log(`[MetricsCache] Calculating metrics for branch ${branchId}...`);

    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [branch, revenue, requests] = await Promise.all([
            db.branch.findUnique({
                where: { id: branchId },
                select: { id: true, name: true, code: true, type: true }
            }),
            db.payment.aggregate({
                where: {
                    branchId,
                    createdAt: { gte: startOfMonth }
                },
                _sum: { amount: true }
            }),
            db.maintenanceRequest.count({
                where: {
                    branchId,
                    createdAt: { gte: startOfMonth }
                }
            })
        ]);

        if (!branch) return null;

        const closedRequests = await db.maintenanceRequest.count({
            where: {
                branchId,
                status: 'Closed',
                closingTimestamp: { gte: startOfMonth }
            }
        });

        const metrics = {
            branch,
            currentMonthRevenue: revenue._sum.amount || 0,
            totalRequests: requests,
            closedRequests,
            closureRate: requests > 0 ? Math.round((closedRequests / requests) * 100) : 0,
            lastUpdated: new Date().toISOString()
        };

        // Update branch cache
        metricsCache.branchData[branchId] = {
            lastUpdated: metrics.lastUpdated,
            data: metrics
        };

        return metrics;

    } catch (error) {
        console.error(`[MetricsCache] Error calculating branch ${branchId} metrics:`, error);
        throw error;
    }
}

/**
 * Initialize the metrics cache on startup
 */
async function initializeCache() {
    try {
        console.log('[MetricsCache] Initializing metrics cache...');
        await calculateAllMetrics();
        console.log('[MetricsCache] Cache initialized successfully');
    } catch (error) {
        console.error('[MetricsCache] Failed to initialize cache:', error);
    }
}

/**
 * Clear all cached data
 */
function clearCache() {
    metricsCache = {
        lastUpdated: null,
        data: null,
        branchData: {}
    };
    console.log('[MetricsCache] Cache cleared');
}

/**
 * Get cache statistics
 */
function getCacheStats() {
    return {
        initialized: !!metricsCache.lastUpdated,
        lastUpdated: metricsCache.lastUpdated,
        cacheAge: metricsCache.lastUpdated
            ? Math.round((Date.now() - new Date(metricsCache.lastUpdated).getTime()) / 1000)
            : null,
        branchCount: Object.keys(metricsCache.branchData).length
    };
}

module.exports = {
    getCachedMetrics,
    getCachedBranchMetrics,
    calculateAllMetrics,
    calculateBranchMetrics,
    initializeCache,
    clearCache,
    getCacheStats
};
