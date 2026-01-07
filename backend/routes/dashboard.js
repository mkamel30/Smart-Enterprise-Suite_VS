const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// GET Dashboard Stats
router.get('/', authenticateToken, async (req, res) => {
    try {
        const baseBranchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;
        const branchFilter = { ...baseBranchFilter };

        if (targetBranchId && (['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role))) {
            branchFilter.branchId = targetBranchId;
        }

        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

        // 1. Financial Stats (This Month)
        // Check Payment table for unified revenue
        const monthlyRevenue = await db.payment.aggregate(ensureBranchWhere({
            where: {
                ...branchFilter,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            _sum: { amount: true }
        }, req));

        // Calculate Weekly Trend for this month
        const paymentsThisMonth = await db.payment.findMany(ensureBranchWhere({
            where: {
                ...branchFilter,
                createdAt: {
                    gte: startOfMonth,
                    lte: endOfMonth
                }
            },
            select: { amount: true, createdAt: true }
        }, req));

        const weeklyRevenue = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };

        paymentsThisMonth.forEach(p => {
            const day = new Date(p.createdAt).getDate();
            const week = Math.ceil(day / 7);
            if (weeklyRevenue[week] !== undefined) {
                weeklyRevenue[week] += p.amount;
            }
        });

        // Format for Recharts (W1, W2, W3, W4)
        const trendData = [
            { name: 'W1', value: weeklyRevenue[1] },
            { name: 'W2', value: weeklyRevenue[2] },
            { name: 'W3', value: weeklyRevenue[3] },
            { name: 'W4', value: weeklyRevenue[4] + (weeklyRevenue[5] || 0) }
        ];

        // 2. Request Stats
        const openRequests = await db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...branchFilter, status: 'Open' }
        }, req));

        const inProgressRequests = await db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...branchFilter, status: 'In Progress' }
        }, req));

        const requestsByStatus = await db.maintenanceRequest.groupBy(ensureBranchWhere({
            by: ['status'],
            where: branchFilter,
            _count: { id: true }
        }, req));

        // 3. Inventory Alerts (Low Stock)
        const lowStockItems = await db.inventoryItem.findMany(ensureBranchWhere({
            where: {
                ...branchFilter,
                quantity: { lte: 5 }
            },
            include: { part: true },
            take: 5
        }, req));

        // 4. Overdue Installments
        // Hide for Center roles
        const isCenterRole = ['CENTER_MANAGER', 'CENTER_TECH'].includes(req.user.role);
        const overdueInstallmentsCount = isCenterRole ? 0 : await db.installment.count({
            where: {
                ...branchFilter,
                isPaid: false,
                dueDate: { lt: today }
            }
        });

        // 5. Recent Activity (Latest 5 payments/actions)
        // Using Payment for activity stream
        const recentPayments = await db.payment.findMany(ensureBranchWhere({
            where: branchFilter,
            take: 5,
            orderBy: { createdAt: 'desc' }
        }, req));

        // 6. Special Stats for Admin Affairs & Stock Managers
        const machinesCount = await db.warehouseMachine.count(ensureBranchWhere({ where: branchFilter }, req));
        const simsCount = await db.warehouseSim.count(ensureBranchWhere({ where: branchFilter }, req));

        // 7. Maintenance Stats (Paid vs Free Parts Comparison)
        // This is specifically for Center Dashboards
        let maintenanceStats = null;
        if (isCenterRole || req.user.role === 'SUPER_ADMIN') {
            const maintenancePayments = await db.payment.findMany(ensureBranchWhere({
                where: {
                    ...branchFilter,
                    type: 'MAINTENANCE',
                    createdAt: { gte: startOfMonth, lte: endOfMonth }
                },
                select: { amount: true, requestId: true }
            }, req));

            const paidRequestIds = maintenancePayments.map(p => p.requestId).filter(id => id);

            // Replaced Parts count (Paid)
            const paidPartsCount = await db.stockMovement.aggregate(ensureBranchWhere({
                where: {
                    ...branchFilter,
                    type: 'OUT',
                    requestId: { in: paidRequestIds },
                    createdAt: { gte: startOfMonth, lte: endOfMonth }
                },
                _sum: { quantity: true }
            }, req));

            // Replaced Parts count (Free/Warranty)
            const freePartsCount = await db.stockMovement.aggregate(ensureBranchWhere({
                where: {
                    ...branchFilter,
                    type: 'OUT',
                    requestId: { notIn: paidRequestIds },
                    createdAt: { gte: startOfMonth, lte: endOfMonth }
                },
                _sum: { quantity: true }
            }, req));

            maintenanceStats = {
                revenue: maintenancePayments.reduce((sum, p) => sum + p.amount, 0),
                paidCount: paidPartsCount._sum.quantity || 0,
                freeCount: freePartsCount._sum.quantity || 0
            };
        }

        // Pending Transfer Orders (Incoming/Outgoing for this branch)
        // If branchFilter is empty (Admin), show all pending
        const transferFilter = {};
        if (req.user.branchId) {
            transferFilter.OR = [
                { fromBranchId: req.user.branchId },
                { toBranchId: req.user.branchId }
            ];
        }
        const pendingTransfers = await db.transferOrder.count(ensureBranchWhere({
            where: {
                ...transferFilter,
                status: 'PENDING'
            }
        }, req));

        res.json({
            revenue: {
                monthly: monthlyRevenue._sum.amount || 0,
                trend: trendData
            },
            requests: {
                open: openRequests,
                inProgress: inProgressRequests,
                distribution: requestsByStatus.map(s => ({ name: s.status, value: s._count.id }))
            },
            inventory: {
                lowStock: lowStockItems,
                machines: machinesCount,
                sims: simsCount
            },
            alerts: {
                overdueInstallments: overdueInstallmentsCount,
                pendingTransfers: pendingTransfers
            },
            maintenanceStats,
            recentActivity: recentPayments
        });


    } catch (error) {
        console.error('Dashboard error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch dashboard stats', details: error.message });
    }
});

// GET Admin Summary (Global view for Super Admin)
router.get('/admin-summary', authenticateToken, async (req, res) => {
    if (req.user.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Access denied: Admin only' });
    }

    try {
        const today = new Date();
        const startOfToday = new Date(today.setHours(0, 0, 0, 0));
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        // 1. General counts
        const usersCount = await db.user.count(ensureBranchWhere({}, req));
        const branchesCount = await db.branch.count({
            where: { type: 'BRANCH' }
        });
        const totalMachines = await db.warehouseMachine.count(ensureBranchWhere({}, req));
        const dailyOps = await db.systemLog.count(ensureBranchWhere({
            where: { createdAt: { gte: startOfToday } }
        }, req));

        // 2. Branch Performance
        const branches = await db.branch.findMany({
            where: { type: 'BRANCH' },
            select: { id: true, name: true }
        });

        const performanceData = await Promise.all(branches.map(async (branch) => {
            const revenue = await db.payment.aggregate(ensureBranchWhere({
                where: {
                    branchId: branch.id,
                    createdAt: { gte: startOfMonth }
                },
                _sum: { amount: true }
            }, req));

            const repairs = await db.maintenanceRequest.count(ensureBranchWhere({
                where: {
                    branchId: branch.id,
                    createdAt: { gte: startOfMonth },
                    status: 'Done'
                }
            }, req));

            return {
                name: branch.name,
                revenue: revenue._sum.amount || 0,
                repairs: repairs
            };
        }));

        // 3. Specialized Entities (Admin Affairs & Maintenance Centers)
        const adminAffairs = await db.branch.findMany({ where: { type: 'ADMIN_AFFAIRS' }, select: { id: true, name: true } });
        const maintenanceCenters = await db.branch.findMany({ where: { type: 'MAINTENANCE_CENTER' }, select: { id: true, name: true } });

        const adminAffairsStats = await Promise.all(adminAffairs.map(async (branch) => {
            const machineTransfers = await db.transferOrder.count(ensureBranchWhere({
                where: { fromBranchId: branch.id, type: 'MACHINE', status: 'RECEIVED', updatedAt: { gte: startOfMonth } }
            }, req));
            const simTransfers = await db.transferOrder.count(ensureBranchWhere({
                where: { fromBranchId: branch.id, type: 'SIM', status: 'RECEIVED', updatedAt: { gte: startOfMonth } }
            }, req));

            return { id: branch.id, name: branch.name, machineTransfers, simTransfers };
        }));

        const maintenanceCenterStats = await Promise.all(maintenanceCenters.map(async (center) => {
            const partTransfers = await db.transferOrder.count(ensureBranchWhere({
                where: { fromBranchId: center.id, type: 'SPARE_PART', status: 'RECEIVED', updatedAt: { gte: startOfMonth } }
            }, req));

            const machinesInRepair = await db.warehouseMachine.count(ensureBranchWhere({
                where: { branchId: center.id, status: { in: ['AT_CENTER', 'UNDER_INSPECTION', 'AWAITING_APPROVAL', 'IN_PROGRESS'] } }
            }, req));

            const machinesRepaired = await db.warehouseMachine.count(ensureBranchWhere({
                where: { branchId: center.id, status: { in: ['READY_FOR_RETURN', 'COMPLETED'] }, updatedAt: { gte: startOfMonth } }
            }, req));

            return {
                id: center.id,
                name: center.name,
                partTransfers,
                inRepair: machinesInRepair,
                repaired: machinesRepaired
            };
        }));

        // 4. Advanced Intelligence
        // A. Real System Health (based on recent logs)
        const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const totalRecentLogs = await db.systemLog.count({ where: { createdAt: { gte: twentyFourHoursAgo } } });
        const errorLogs = await db.systemLog.count({
            where: {
                createdAt: { gte: twentyFourHoursAgo },
                OR: [
                    { action: { contains: 'ERROR' } },
                    { details: { contains: 'failed' } },
                    { details: { contains: 'ط®ط·ط£' } }
                ]
            }
        });

        const healthScore = totalRecentLogs > 0
            ? Math.max(0, Math.min(100, 100 - (errorLogs / totalRecentLogs * 100)))
            : 100;

        // B. Global Inventory Low Stock (Items low across the whole system)
        const globalLowStock = await db.inventoryItem.groupBy(ensureBranchWhere({
            by: ['partId'],
            _sum: { quantity: true },
            having: {
                quantity: { _sum: { lte: 20 } }
            }
        }, req));

        const lowStockDetails = await Promise.all(globalLowStock.map(async (item) => {
            const part = await db.sparePart.findUnique({
                where: { id: item.partId },
                select: { name: true, partNumber: true }
            });
            return {
                name: part?.name || 'Unknown Part',
                partNumber: part?.partNumber,
                totalQuantity: item._sum.quantity
            };
        }));

        res.json({
            usersCount,
            branchesCount,
            totalMachines,
            dailyOps,
            branchPerformance: performanceData,
            adminAffairsStats,
            maintenanceCenterStats,
            systemHealth: {
                score: Math.round(healthScore),
                errorCount: errorLogs
            },
            globalLowStock: lowStockDetails
        });

    } catch (error) {
        console.error('Admin summary error:', error);
        console.error('Error stack:', error.stack);
        console.error('Error message:', error.message);
        res.status(500).json({ error: 'Failed to fetch admin summary', details: error.message });
    }
});

// GET Global Search
router.get('/search', authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) return res.json({ machines: [], customers: [] });

        const branchFilter = getBranchFilter(req);

        // 1. Search Machines (Serial Number)
        const machines = await db.warehouseMachine.findMany(ensureBranchWhere({
            where: {
                ...branchFilter,
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
        }, req));

        // 2. Search Customers (BK Code or Name)
        const customers = await db.customer.findMany(ensureBranchWhere({
            where: {
                ...branchFilter,
                OR: [
                    { bkcode: { contains: q } },
                    { name: { contains: q } }
                ]
            },
            take: 10,
            select: {
                id: true,
                bkcode: true,
                name: true,
                branch: { select: { name: true } }
            }
        }, req));

        res.json({
            machines: machines.map(m => ({ ...m, type: 'MACHINE' })),
            customers: customers.map(c => ({ ...c, type: 'CUSTOMER' }))
        });

    } catch (error) {
        console.error('Global search error:', error);
        res.status(500).json({ error: 'Search failed' });
    }
});

module.exports = router;
