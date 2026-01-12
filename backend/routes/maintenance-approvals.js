const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
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
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
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
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
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
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
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
