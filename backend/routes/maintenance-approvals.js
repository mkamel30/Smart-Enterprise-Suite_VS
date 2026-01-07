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

        const requests = await db.maintenanceApprovalRequest.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' }
        }, req));

        res.json(requests);
    } catch (error) {
        console.error('Failed to fetch approval requests:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط·ظ„ط¨ط§طھ ط§ظ„ظ…ظˆط§ظپظ‚ط©' });
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
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¹ط¯ ط§ظ„ط·ظ„ط¨ط§طھ ط§ظ„ظ…ط¹ظ„ظ‚ط©' });
    }
});

// Get single approval request
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const request = await db.maintenanceApprovalRequest.findUnique({
            where: { id: req.params.id }
        });

        if (!request) {
            return res.status(404).json({ error: 'ط·ظ„ط¨ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }
        
        // Authorization check
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
        if (!isAdmin && request.targetBranchId !== req.user.branchId && request.centerBranchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(request);
    } catch (error) {
        console.error('Failed to fetch approval request:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط·ظ„ط¨ ط§ظ„ظ…ظˆط§ظپظ‚ط©' });
    }
});

// Approve request (ط§ظ„ظپط±ط¹ ظٹظˆط§ظپظ‚)
router.put('/:id/approve', authenticateToken, async (req, res) => {
    try {
        const approvalRequest = await db.maintenanceApprovalRequest.findUnique({
            where: { id: req.params.id }
        });

        if (!approvalRequest) {
            return res.status(404).json({ error: 'ط·ظ„ط¨ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }
        
        // Authorization check
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
        if (!isAdmin && approvalRequest.targetBranchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (approvalRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'طھظ… ط§ظ„ط±ط¯ ط¹ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ط¨ظ‚ط§ظ‹' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update approval request
            const updated = await tx.serviceApprovalRequest.update({
                where: { id: req.params.id },
                data: {
                    status: 'APPROVED',
                    respondedBy: req.user.displayName || req.user.email,
                    respondedById: req.user.id,
                    respondedAt: new Date()
                }
            });

            // Update assignment IF exists
            if (approvalRequest.assignmentId) {
                await tx.serviceAssignment.update({
                    where: { id: approvalRequest.assignmentId },
                    data: {
                        status: 'APPROVED',
                        approvalStatus: 'APPROVED'
                    }
                });

                // Update machine status via assignment machineId
                const assignment = await tx.serviceAssignment.findUnique({
                    where: { id: approvalRequest.assignmentId }
                });

                if (assignment) {
                    await tx.warehouseMachine.update({
                        where: { id: assignment.machineId },
                        data: { status: 'REPAIR_APPROVED' } // Changed from APPROVED to REPAIR_APPROVED for clarity
                    });

                    // Log
                    await tx.serviceAssignmentLog.create({
                        data: {
                            assignmentId: approvalRequest.assignmentId,
                            action: 'APPROVED',
                            details: 'طھظ…طھ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„طµظٹط§ظ†ط© ظ…ظ† ط§ظ„ظپط±ط¹',
                            performedBy: req.user.displayName || req.user.email,
                            performedById: req.user.id
                        }
                    });
                }
            } else {
                // No assignment (Batch Workflow) - Update Machine Directly by Serial
                await tx.warehouseMachine.update({
                    where: { serialNumber: approvalRequest.machineSerial },
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
            title: 'âœ… طھظ…طھ ط§ظ„ظ…ظˆط§ظپظ‚ط©',
            message: `طھظ…طھ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ طµظٹط§ظ†ط© ط§ظ„ظ…ط§ظƒظٹظ†ط© ${approvalRequest.machineSerial}`,
            link: '/maintenance/shipments'
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to approve request:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط¹ظ„ظ‰ ط§ظ„ط·ظ„ط¨' });
    }
});

// Reject request (ط§ظ„ظپط±ط¹ ظٹط±ظپط¶)
router.put('/:id/reject', authenticateToken, async (req, res) => {
    try {
        const { rejectionReason } = req.body;

        const approvalRequest = await db.maintenanceApprovalRequest.findUnique({
            where: { id: req.params.id }
        });

        if (!approvalRequest) {
            return res.status(404).json({ error: 'ط·ظ„ط¨ ط§ظ„ظ…ظˆط§ظپظ‚ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }
        
        // Authorization check
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
        if (!isAdmin && approvalRequest.targetBranchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (approvalRequest.status !== 'PENDING') {
            return res.status(400).json({ error: 'طھظ… ط§ظ„ط±ط¯ ط¹ظ„ظ‰ ظ‡ط°ط§ ط§ظ„ط·ظ„ط¨ ظ…ط³ط¨ظ‚ط§ظ‹' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update approval request
            const updated = await tx.serviceApprovalRequest.update({
                where: { id: req.params.id },
                data: {
                    status: 'REJECTED',
                    rejectionReason,
                    respondedBy: req.user.displayName || req.user.email,
                    respondedById: req.user.id,
                    respondedAt: new Date()
                }
            });

            // Update assignment IF exists
            if (approvalRequest.assignmentId) {
                await tx.serviceAssignment.update({
                    where: { id: approvalRequest.assignmentId },
                    data: {
                        status: 'REJECTED',
                        approvalStatus: 'REJECTED',
                        rejectionFlag: true,
                        rejectionReason
                    }
                });

                // Update machine status
                const assignment = await tx.serviceAssignment.findUnique({
                    where: { id: approvalRequest.assignmentId }
                });

                if (assignment) {
                    await tx.warehouseMachine.update({
                        where: { id: assignment.machineId },
                        data: { status: 'REPAIR_REJECTED' }
                    });

                    // Log
                    await tx.serviceAssignmentLog.create({
                        data: {
                            assignmentId: approvalRequest.assignmentId,
                            action: 'REJECTED',
                            details: `طھظ… ط±ظپط¶ ط§ظ„ظ…ظˆط§ظپظ‚ط©${rejectionReason ? ': ' + rejectionReason : ''}`,
                            performedBy: req.user.displayName || req.user.email,
                            performedById: req.user.id
                        }
                    });
                }
            } else {
                // No assignment (Batch Workflow) - Update Machine Directly
                await tx.warehouseMachine.update({
                    where: { serialNumber: approvalRequest.machineSerial },
                    data: { status: 'REPAIR_REJECTED' }
                });
            }

            return updated;
        });

        // Notify the maintenance center
        await createNotification({
            branchId: approvalRequest.centerBranchId,
            type: 'APPROVAL_RESPONSE',
            title: 'â‌Œ طھظ… ط±ظپط¶ ط§ظ„ظ…ظˆط§ظپظ‚ط©',
            message: `طھظ… ط±ظپط¶ طµظٹط§ظ†ط© ط§ظ„ظ…ط§ظƒظٹظ†ط© ${approvalRequest.machineSerial}${rejectionReason ? ' - ط§ظ„ط³ط¨ط¨: ' + rejectionReason : ''}`,
            link: '/maintenance/shipments'
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to reject request:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط±ظپط¶ ط§ظ„ط·ظ„ط¨' });
    }
});

module.exports = router;
