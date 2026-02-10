const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { isGlobalRole } = require('../utils/constants');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get all approval requests for branch
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, status } = req.query;

        const where = {};

        // Filter by target branch (the branch that needs to approve)
        if (branchId) {
            where.targetBranchId = branchId;
        } else if (req.user.branchId) {
            where.targetBranchId = req.user.branchId;
        }

        if (status) where.status = status;

        // Note: MaintenanceApprovalRequest has no branchId field - uses originBranchId/centerBranchId
        // Already filtered by targetBranchId above
        const requests = await db.maintenanceApprovalRequest.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch approval requests:', error);
        res.status(500).json({ error: 'فشل في جلب طلبات الموافقة' });
    }
});

// Get pending approval requests count
router.get('/pending-count', authenticateToken, async (req, res) => {
    try {
        const branchId = req.query.branchId || req.user.branchId;

        const count = await db.maintenanceApprovalRequest.count({
            where: {
                targetBranchId: branchId,
                status: 'PENDING'
            }
        });

        res.json({ count });
    } catch (error) {
        console.error('Failed to count pending approvals:', error);
        res.status(500).json({ error: 'فشل في عد الطلبات المعلقة' });
    }
});

// Get approval statistics
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const { branchId, period = 'month', month, quarter, year } = req.query;
        const userBranchId = branchId || req.user.branchId;

        // Build date filter
        let startDate, endDate;
        const now = new Date();
        
        if (period === 'month') {
            const targetMonth = month !== undefined ? parseInt(month) : now.getMonth();
            const targetYear = year ? parseInt(year) : now.getFullYear();
            startDate = new Date(targetYear, targetMonth, 1);
            endDate = new Date(targetYear, targetMonth + 1, 0, 23, 59, 59, 999);
        } else if (period === 'quarter') {
            const targetQuarter = quarter !== undefined ? parseInt(quarter) : Math.floor(now.getMonth() / 3);
            const targetYear = year ? parseInt(year) : now.getFullYear();
            startDate = new Date(targetYear, targetQuarter * 3, 1);
            endDate = new Date(targetYear, (targetQuarter + 1) * 3, 0, 23, 59, 59, 999);
        } else if (period === 'year') {
            const targetYear = year ? parseInt(year) : now.getFullYear();
            startDate = new Date(targetYear, 0, 1);
            endDate = new Date(targetYear, 11, 31, 23, 59, 59, 999);
        } else {
            // Default: current month
            startDate = new Date(now.getFullYear(), now.getMonth(), 1);
            endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
        }

        // Build where clause
        const baseWhere = {
            targetBranchId: userBranchId,
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        };

        // Count by status
        const [pending, approved, rejected, totalCostApproved, totalCostRejected] = await Promise.all([
            db.maintenanceApprovalRequest.count({
                where: { ...baseWhere, status: 'PENDING' }
            }),
            db.maintenanceApprovalRequest.count({
                where: { ...baseWhere, status: 'APPROVED' }
            }),
            db.maintenanceApprovalRequest.count({
                where: { ...baseWhere, status: 'REJECTED' }
            }),
            // Sum approved costs
            db.maintenanceApprovalRequest.aggregate({
                where: { ...baseWhere, status: 'APPROVED' },
                _sum: { proposedTotal: true }
            }),
            // Sum rejected costs
            db.maintenanceApprovalRequest.aggregate({
                where: { ...baseWhere, status: 'REJECTED' },
                _sum: { proposedTotal: true }
            })
        ]);

        // Get branch breakdown for admin
        let branchBreakdown = null;
        if (isGlobalRole(req.user.role)) {
            const branches = await db.branch.findMany({
                where: { type: 'BRANCH', isActive: true },
                select: { id: true, name: true }
            });

            branchBreakdown = await Promise.all(branches.map(async (branch) => {
                const branchWhere = {
                    targetBranchId: branch.id,
                    createdAt: { gte: startDate, lte: endDate }
                };

                const [p, a, r] = await Promise.all([
                    db.maintenanceApprovalRequest.count({ where: { ...branchWhere, status: 'PENDING' } }),
                    db.maintenanceApprovalRequest.count({ where: { ...branchWhere, status: 'APPROVED' } }),
                    db.maintenanceApprovalRequest.count({ where: { ...branchWhere, status: 'REJECTED' } })
                ]);

                return {
                    branchId: branch.id,
                    branchName: branch.name,
                    pending: p,
                    approved: a,
                    rejected: r,
                    total: p + a + r
                };
            }));
        }

        res.json({
            pending,
            approved,
            rejected,
            total: pending + approved + rejected,
            totalCostApproved: totalCostApproved._sum.proposedTotal || 0,
            totalCostRejected: totalCostRejected._sum.proposedTotal || 0,
            period: {
                type: period,
                startDate,
                endDate
            },
            branchBreakdown
        });
    } catch (error) {
        console.error('Failed to fetch approval stats:', error);
        res.status(500).json({ error: 'فشل في جلب إحصائيات الموافقات' });
    }
});

// Get single approval request
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const request = await db.maintenanceApprovalRequest.findFirst({
            where: {
                id: req.params.id,
                OR: [
                    { targetBranchId: req.user.branchId },
                    { centerBranchId: req.user.branchId }
                ]
            }
        });

        if (!request) {
            return res.status(404).json({ error: 'طلب الموافقة غير موجود' });
        }

        // Authorization check
        const isAdmin = isGlobalRole(req.user?.role);
        if (!isAdmin && request.targetBranchId !== req.user.branchId && request.centerBranchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(request);
    } catch (error) {
        console.error('Failed to fetch approval request:', error);
        res.status(500).json({ error: 'فشل في جلب طلب الموافقة' });
    }
});

// Approve request (الفرع يوافق)
router.put('/:id/approve', authenticateToken, async (req, res) => {
    try {
        const approvalRequest = await db.maintenanceApprovalRequest.findFirst({
            where: { id: req.params.id, targetBranchId: req.user.branchId }
        });

        if (!approvalRequest) {
            return res.status(404).json({ error: 'طلب الموافقة غير موجود' });
        }

        // Authorization check
        const isAdmin = isGlobalRole(req.user?.role);
        if (!isAdmin && approvalRequest.targetBranchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (approvalRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'تم الرد على هذا الطلب مسبقاً' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update approval request
            await tx.maintenanceApprovalRequest.updateMany({
                where: { id: req.params.id, targetBranchId: req.user.branchId },
                data: {
                    status: 'APPROVED',
                    respondedBy: req.user.displayName || req.user.email,
                    respondedById: req.user.id,
                    respondedAt: new Date()
                }
            });

            const updated = await tx.maintenanceApprovalRequest.findFirst({
                where: { id: req.params.id }
            });

            // Update assignment IF exists
            if (approvalRequest.assignmentId) {
                await tx.serviceAssignment.updateMany({
                    where: { id: approvalRequest.assignmentId, originBranchId: req.user.branchId },
                    data: {
                        status: 'APPROVED',
                        approvalStatus: 'APPROVED'
                    }
                });

                // Update machine status via assignment machineId
                const assignment = await tx.serviceAssignment.findFirst({
                    where: { id: approvalRequest.assignmentId, originBranchId: req.user.branchId }
                });

                if (assignment) {
                    await tx.warehouseMachine.updateMany({
                        where: { id: assignment.machineId, branchId: approvalRequest.centerBranchId },
                        data: { status: 'REPAIR_APPROVED' } // Changed from APPROVED to REPAIR_APPROVED for clarity
                    });

                    // Log
                    await tx.serviceAssignmentLog.create({
                        data: {
                            assignmentId: approvalRequest.assignmentId,
                            action: 'APPROVED',
                            details: 'تمت الموافقة على الصيانة من الفرع',
                            performedBy: req.user.displayName || req.user.email,
                            performedById: req.user.id
                        }
                    });
                }
            } else {
                // No assignment (Batch Workflow) - Update Machine Directly by Serial
                await tx.warehouseMachine.updateMany({
                    where: { serialNumber: approvalRequest.machineSerial, branchId: approvalRequest.centerBranchId },
                    data: {
                        status: 'REPAIR_APPROVED',
                        // If we had a boolean/flag for approval, set it here
                    }
                });

                // Keep Log? SystemLog maybe?
            }

            return updated;
        });

        // Notify the maintenance center
        await createNotification({
            branchId: approvalRequest.centerBranchId,
            type: 'APPROVAL_RESPONSE',
            title: '✅ تمت الموافقة',
            message: `تمت الموافقة على صيانة الماكينة ${approvalRequest.machineSerial}`,
            link: '/maintenance/shipments'
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to approve request:', error);
        res.status(500).json({ error: 'فشل في الموافقة على الطلب' });
    }
});

// Reject request (الفرع يرفض)
router.put('/:id/reject', authenticateToken, async (req, res) => {
    try {
        const { rejectionReason } = req.body;

        const approvalRequest = await db.maintenanceApprovalRequest.findFirst({
            where: { id: req.params.id, targetBranchId: req.user.branchId }
        });

        if (!approvalRequest) {
            return res.status(404).json({ error: 'طلب الموافقة غير موجود' });
        }

        // Authorization check
        const isAdmin = isGlobalRole(req.user?.role);
        if (!isAdmin && approvalRequest.targetBranchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (approvalRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'تم الرد على هذا الطلب مسبقاً' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update approval request
            await tx.maintenanceApprovalRequest.updateMany({
                where: { id: req.params.id, targetBranchId: req.user.branchId },
                data: {
                    status: 'REJECTED',
                    rejectionReason,
                    respondedBy: req.user.displayName || req.user.email,
                    respondedById: req.user.id,
                    respondedAt: new Date()
                }
            });

            const updated = await tx.maintenanceApprovalRequest.findFirst({
                where: { id: req.params.id }
            });

            // Update assignment IF exists
            if (approvalRequest.assignmentId) {
                await tx.serviceAssignment.updateMany({
                    where: { id: approvalRequest.assignmentId, originBranchId: req.user.branchId },
                    data: {
                        status: 'REJECTED',
                        approvalStatus: 'REJECTED',
                        rejectionFlag: true,
                        rejectionReason
                    }
                });

                // Update machine status
                const assignment = await tx.serviceAssignment.findFirst({
                    where: { id: approvalRequest.assignmentId, originBranchId: req.user.branchId }
                });

                if (assignment) {
                    await tx.warehouseMachine.updateMany({
                        where: { id: assignment.machineId, branchId: approvalRequest.centerBranchId },
                        data: { status: 'REPAIR_REJECTED' }
                    });

                    // Log
                    await tx.serviceAssignmentLog.create({
                        data: {
                            assignmentId: approvalRequest.assignmentId,
                            action: 'REJECTED',
                            details: `تم رفض الموافقة${rejectionReason ? ': ' + rejectionReason : ''}`,
                            performedBy: req.user.displayName || req.user.email,
                            performedById: req.user.id
                        }
                    });
                }
            } else {
                // No assignment (Batch Workflow) - Update Machine Directly
                await tx.warehouseMachine.updateMany({
                    where: { serialNumber: approvalRequest.machineSerial, branchId: approvalRequest.centerBranchId },
                    data: { status: 'REPAIR_REJECTED' }
                });
            }

            return updated;
        });

        // Notify the maintenance center
        await createNotification({
            branchId: approvalRequest.centerBranchId,
            type: 'APPROVAL_RESPONSE',
            title: '❌ تم رفض الموافقة',
            message: `تم رفض صيانة الماكينة ${approvalRequest.machineSerial}${rejectionReason ? ' - السبب: ' + rejectionReason : ''}`,
            link: '/maintenance/shipments'
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to reject request:', error);
        res.status(500).json({ error: 'فشل في رفض الطلب' });
    }
});

module.exports = router;
