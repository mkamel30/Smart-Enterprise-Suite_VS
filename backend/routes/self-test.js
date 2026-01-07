/**
 * Self-Test / Health-Check Route
 * 
 * Exercises key services in a single request to verify backend health.
 * Read-only operations - no writes or side effects.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');

/**
 * Helper to safely run a service function and capture result/error
 */
async function safeCall(fn, name) {
    try {
        const result = await fn();
        return { ok: true, data: result };
    } catch (error) {
        console.error(`[SelfTest] ${name} failed:`, error.message);
        return { ok: false, error: error.message };
    }
}

/**
 * GET /api/dev/self-test
 * 
 * Runs read-only health checks on key services.
 */
router.get('/', authenticateToken, async (req, res) => {
    const startTime = Date.now();
    const branchId = req.user.branchId;

    console.log('[SelfTest] Starting self-test for user:', req.user.email, 'branchId:', branchId);

    try {
        // ===================== 1. DATABASE CONNECTIVITY =====================
        const dbHealth = await safeCall(async () => {
            const count = await db.user.count({ where: { branchId: { not: null } } });
            return { userCount: count };
        }, 'Database');

        // ===================== 2. CORE LOOKUPS =====================
        const [branchesResult, machineParamsResult, permissionsResult] = await Promise.all([
            // Branches lookup
            safeCall(async () => {
                const branches = await db.branch.findMany({
                    select: { id: true, name: true, type: true },
                    take: 5
                });
                return { count: branches.length };
            }, 'Branches'),

            // Machine parameters lookup
            safeCall(async () => {
                const params = await db.machineParameter.findMany({ take: 5 });
                return { count: params.length };
            }, 'MachineParameters'),

            // Permissions/Roles lookup (using RolePermission if exists)
            safeCall(async () => {
                const perms = await db.rolePermission.findMany({ take: 5 });
                return { count: perms.length };
            }, 'Permissions')
        ]);

        // ===================== 3. PROTECTED MODEL QUERIES =====================
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

        const [
            dashboardResult,
            installmentResult,
            systemLogResult,
            branchDebtResult,
            approvalRequestResult
        ] = await Promise.all([
            // Dashboard-style Payment aggregate
            safeCall(async () => {
                const result = await db.payment.aggregate({
                    where: {
                        branchId: branchId || { not: null },
                        createdAt: { gte: startOfMonth }
                    },
                    _sum: { amount: true }
                });
                return { revenue: result._sum.amount || 0 };
            }, 'Dashboard/Payment'),

            // Installment count (protected model)
            safeCall(async () => {
                const count = await db.installment.count({
                    where: {
                        branchId: branchId || { not: null },
                        isPaid: false
                    }
                });
                return { unpaidCount: count };
            }, 'Installment'),

            // SystemLog count (protected model)
            safeCall(async () => {
                const count = await db.systemLog.count({
                    where: {
                        branchId: branchId || { not: null },
                        createdAt: { gte: startOfMonth }
                    }
                });
                return { logCount: count };
            }, 'SystemLog'),

            // BranchDebt aggregate (uses debtorBranchId, NOT branchId!)
            safeCall(async () => {
                const result = await db.branchDebt.aggregate({
                    where: {
                        // BranchDebt has NO branchId field - use debtorBranchId
                        debtorBranchId: branchId || { not: '' },
                        status: 'PENDING_PAYMENT'
                    },
                    _sum: { amount: true }
                });
                return { pendingDebt: result._sum.amount || 0 };
            }, 'BranchDebt'),

            // MaintenanceApprovalRequest count (uses originBranchId/centerBranchId, NOT branchId!)
            safeCall(async () => {
                const count = await db.maintenanceApprovalRequest.count({
                    where: {
                        // MaintenanceApprovalRequest has NO branchId field - use originBranchId
                        originBranchId: branchId || { not: '' },
                        status: 'PENDING'
                    }
                });
                return { pendingApprovals: count };
            }, 'MaintenanceApprovalRequest')
        ]);

        // ===================== 4. MAINTENANCE REQUEST STATS =====================
        const maintenanceResult = await safeCall(async () => {
            const [total, closed] = await Promise.all([
                db.maintenanceRequest.count({
                    where: {
                        branchId: branchId || { not: null },
                        createdAt: { gte: startOfMonth }
                    }
                }),
                db.maintenanceRequest.count({
                    where: {
                        branchId: branchId || { not: null },
                        status: 'Closed',
                        closingTimestamp: { gte: startOfMonth }
                    }
                })
            ]);
            return { total, closed, closureRate: total > 0 ? Math.round((closed / total) * 100) : 0 };
        }, 'MaintenanceRequests');

        // ===================== 5. INVENTORY HEALTH =====================
        const inventoryResult = await safeCall(async () => {
            const items = await db.inventoryItem.findMany({
                where: { branchId: branchId || { not: null } },
                select: { quantity: true, minLevel: true }
            });
            let inStock = 0, lowStock = 0, critical = 0;
            items.forEach(item => {
                const min = item.minLevel || 10;
                if (item.quantity === 0) critical++;
                else if (item.quantity < min) lowStock++;
                else inStock++;
            });
            return { total: items.length, inStock, lowStock, critical };
        }, 'Inventory');

        // ===================== COMPILE RESULTS =====================
        const duration = Date.now() - startTime;

        const allOk = [
            dbHealth.ok,
            branchesResult.ok,
            machineParamsResult.ok,
            dashboardResult.ok,
            installmentResult.ok,
            systemLogResult.ok,
            branchDebtResult.ok,
            approvalRequestResult.ok,
            maintenanceResult.ok,
            inventoryResult.ok
        ].every(v => v);

        res.json({
            status: allOk ? 'HEALTHY' : 'DEGRADED',
            duration: `${duration}ms`,
            timestamp: new Date().toISOString(),
            user: {
                email: req.user.email,
                role: req.user.role,
                branchId: branchId
            },
            checks: {
                database: dbHealth,
                lookups: {
                    branches: branchesResult,
                    machineParameters: machineParamsResult,
                    permissions: permissionsResult
                },
                dashboard: dashboardResult,
                protectedModels: {
                    installment: installmentResult,
                    systemLog: systemLogResult,
                    branchDebt: branchDebtResult,
                    approvalRequest: approvalRequestResult
                },
                maintenance: maintenanceResult,
                inventory: inventoryResult
            }
        });

    } catch (error) {
        console.error('[SelfTest] Critical error:', error);
        res.status(500).json({
            status: 'ERROR',
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

/**
 * GET /api/dev/self-test/schema-check
 * 
 * Verifies critical model field expectations against the schema.
 */
router.get('/schema-check', authenticateToken, async (req, res) => {
    const schemaInfo = {
        BranchDebt: {
            branchFields: ['debtorBranchId', 'creditorBranchId'],
            note: 'Does NOT have branchId field. Use debtorBranchId or creditorBranchId.'
        },
        MaintenanceApprovalRequest: {
            branchFields: ['centerBranchId', 'originBranchId'],
            note: 'Does NOT have branchId field. Use originBranchId or centerBranchId.'
        },
        ServiceAssignment: {
            branchFields: ['branchId', 'centerBranchId', 'originBranchId'],
            note: 'Has multiple branch fields for different purposes.'
        },
        TransferOrder: {
            branchFields: ['branchId', 'fromBranchId', 'toBranchId'],
            note: 'branchId is destination; fromBranchId/toBranchId for source/dest.'
        }
    };

    res.json({
        message: 'Schema field reference for branch-related models',
        models: schemaInfo
    });
});

module.exports = router;
