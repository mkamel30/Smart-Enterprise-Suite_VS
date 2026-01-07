const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');

// Get machines status for branch (track machines sent to maintenance center)
// Get machines status for branch (track machines sent to maintenance center)
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, status } = req.query;

        // Get the branch ID (origin branch that sent the machines)
        const originBranchId = branchId || req.user.branchId;

        if (!originBranchId) {
            return res.status(400).json({ error: 'يرجى تحديد الفرع' });
        }

        const where = {
            originBranchId: originBranchId,
            // Exclude machines that are just normal stock at the branch
            // We want machines that are in the maintenance cycle
            status: {
                in: [
                    'RECEIVED_AT_CENTER',
                    'ASSIGNED',
                    'UNDER_INSPECTION',
                    'AWAITING_APPROVAL',
                    'PENDING_APPROVAL',
                    'IN_PROGRESS',
                    'READY_FOR_RETURN',
                    'RETURNING',
                    'COMPLETED',
                    'IN_MAINTENANCE'
                ]
            }
        };

        // Filter by status if provided
        if (status) {
            where.status = status;
        }

        // Query WarehouseMachine directly to see everything including unassigned ones
        const machines = await db.warehouseMachine.findMany({
            where,
            include: {
                currentAssignment: {
                    include: {
                        logs: {
                            orderBy: { performedAt: 'desc' },
                            take: 3
                        }
                    }
                }
            },
            orderBy: { updatedAt: 'desc' }
        });

        // Map to the format expected by frontend
        const result = machines.map(m => {
            const assignment = m.currentAssignment || {};
            // Determine effective logs
            // If no assignment logs, maybe we can show basic timeline from machine? 
            // For now, empty logs if no assignment.

            return {
                id: assignment.id || m.id, // Prefer assignment ID if exists, else machine ID
                serialNumber: m.serialNumber,
                status: m.status,
                technicianName: m.currentTechnicianName || 'قيد الانتظار',
                customerName: m.customerName,
                totalCost: assignment.totalCost || 0,
                assignedAt: assignment.assignedAt || m.updatedAt,
                startedAt: assignment.startedAt,
                completedAt: assignment.completedAt,
                rejectionFlag: false, // logic for rejection flag if needed
                machine: {
                    model: m.model,
                    manufacturer: m.manufacturer
                },
                logs: assignment.logs || []
            };
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to fetch tracked machines:', error);
        res.status(500).json({ error: 'فشل في جلب حالة الماكينات' });
    }
});

// Get summary of machines at maintenance center
// Get summary of machines at maintenance center
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const originBranchId = req.query.branchId || req.user.branchId;

        if (!originBranchId) {
            return res.status(400).json({ error: 'يرجى تحديد الفرع' });
        }

        // Count by status from WarehouseMachine directly
        const statuses = await db.warehouseMachine.groupBy({
            by: ['status'],
            where: {
                originBranchId,
                status: {
                    in: [
                        'RECEIVED_AT_CENTER',
                        'ASSIGNED',
                        'UNDER_INSPECTION',
                        'AWAITING_APPROVAL',
                        'PENDING_APPROVAL',
                        'IN_PROGRESS',
                        'READY_FOR_RETURN',
                        'RETURNING',
                        'COMPLETED',
                        'IN_MAINTENANCE'
                    ]
                }
            },
            _count: { id: true }
        });

        const summary = {
            total: 0,
            assigned: 0,
            inProgress: 0,
            pendingApproval: 0,
            approved: 0,
            rejected: 0,
            completed: 0,
            received: 0
        };

        statuses.forEach(s => {
            summary.total += s._count.id;
            const count = s._count.id;
            switch (s.status) {
                case 'RECEIVED_AT_CENTER': summary.received += count; break; // New category
                case 'ASSIGNED': summary.assigned += count; break;
                case 'IN_PROGRESS':
                case 'IN_MAINTENANCE':
                case 'UNDER_INSPECTION': // Group inspection with in progress for simplicity or separate? Let's group.
                    summary.inProgress += count;
                    break;
                case 'PENDING_APPROVAL':
                case 'AWAITING_APPROVAL': // Handle both namings
                    summary.pendingApproval += count;
                    break;
                case 'APPROVED': summary.approved += count; break;
                case 'REJECTED': summary.rejected += count; break;
                case 'COMPLETED':
                case 'READY_FOR_RETURN':
                    summary.completed += count;
                    break;
            }
        });

        res.json(summary);
    } catch (error) {
        console.error('Failed to fetch tracking summary:', error);
        res.status(500).json({ error: 'فشل في جلب ملخص المتابعة' });
    }
});

// Get single machine tracking info
router.get('/:serialNumber', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.params;

        // Find the latest assignment for this machine
        const assignment = await db.serviceAssignment.findFirst({
            where: { serialNumber },
            include: {
                machine: true,
                logs: {
                    orderBy: { performedAt: 'desc' }
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'الماكينة غير موجودة في المركز' });
        }

        res.json(assignment);
    } catch (error) {
        console.error('Failed to fetch machine tracking:', error);
        res.status(500).json({ error: 'فشل في جلب حالة الماكينة' });
    }
});

module.exports = router;
