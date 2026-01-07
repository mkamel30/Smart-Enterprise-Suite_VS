const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');

// Get all assignments for the center
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, status, technicianId } = req.query;

        const where = {};

        // Filter by center branch
        if (branchId) {
            where.branchId = branchId;
        } else if (req.user.branchId) {
            where.branchId = req.user.branchId;
        }

        if (status) where.status = status;
        if (technicianId) where.technicianId = technicianId;

        const assignments = await db.serviceAssignment.findMany({
            where,
            include: {
                machine: true,
                logs: {
                    orderBy: { performedAt: 'desc' },
                    take: 5
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        res.json(assignments);
    } catch (error) {
        console.error('Failed to fetch assignments:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„طھط¹ظٹظٹظ†ط§طھ' });
    }
});

// Get single assignment
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const assignment = await db.serviceAssignment.findUnique({
            where: { id: req.params.id },
            include: {
                machine: true,
                logs: {
                    orderBy: { performedAt: 'desc' }
                }
            }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'ط§ظ„طھط¹ظٹظٹظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        res.json(assignment);
    } catch (error) {
        console.error('Failed to fetch assignment:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„طھط¹ظٹظٹظ†' });
    }
});

// Create new assignment (assign technician to machine)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            machineId,
            technicianId,
            technicianName,
            serialNumber,
            customerId,
            customerName,
            requestId,
            originBranchId
        } = req.body;

        const branchId = req.body.branchId || req.user.branchId;

        // Validate machine exists
        const machine = await db.warehouseMachine.findUnique({
            where: { id: machineId }
        });

        if (!machine) {
            return res.status(404).json({ error: 'ط§ظ„ظ…ط§ظƒظٹظ†ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط©' });
        }

        // Create assignment with transaction
        const result = await db.$transaction(async (tx) => {
            // Create assignment
            const assignment = await tx.serviceAssignment.create({
                data: {
                    machineId,
                    serialNumber: serialNumber || machine.serialNumber,
                    technicianId,
                    technicianName,
                    customerId: customerId || machine.customerId,
                    customerName: customerName || machine.customerName,
                    requestId: requestId || machine.requestId,
                    branchId,
                    originBranchId: originBranchId || machine.originBranchId || branchId,
                    status: 'ASSIGNED'
                }
            });

            // Update machine status and link to assignment
            await tx.warehouseMachine.update({
                where: { id: machineId },
                data: {
                    status: 'ASSIGNED',
                    currentAssignmentId: assignment.id,
                    currentTechnicianId: technicianId,
                    currentTechnicianName: technicianName
                }
            });

            // Log the assignment
            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: assignment.id,
                    action: 'ASSIGNED',
                    details: `طھظ… طھط¹ظٹظٹظ† ${technicianName} ظ„ظ„ظ…ط§ظƒظٹظ†ط© ${serialNumber || machine.serialNumber}`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return assignment;
        });

        // Notify the assigned technician
        if (technicianId !== req.user.id) {
            await createNotification({
                userId: technicianId,
                branchId,
                type: 'ASSIGNMENT',
                title: 'طھط¹ظٹظٹظ† ط¬ط¯ظٹط¯',
                message: `طھظ… طھط¹ظٹظٹظ†ظƒ ظ„طµظٹط§ظ†ط© ط§ظ„ظ…ط§ظƒظٹظ†ط© ${serialNumber || machine.serialNumber}`,
                link: '/maintenance/shipments'
            });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Failed to create assignment:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¥ظ†ط´ط§ط، ط§ظ„طھط¹ظٹظٹظ†' });
    }
});

// Start working on assignment
router.put('/:id/start', authenticateToken, async (req, res) => {
    try {
        const assignment = await db.serviceAssignment.findUnique({
            where: { id: req.params.id }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'ط§ظ„طھط¹ظٹظٹظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update assignment
            const updated = await tx.serviceAssignment.update({
                where: { id: req.params.id },
                data: {
                    status: 'IN_PROGRESS',
                    startedAt: new Date()
                }
            });

            // Update machine status
            await tx.warehouseMachine.update({
                where: { id: assignment.machineId },
                data: { status: 'IN_PROGRESS' }
            });

            // Log
            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: req.params.id,
                    action: 'STARTED',
                    details: 'ط¨ط¯ط£ ط§ظ„ط¹ظ…ظ„ ط¹ظ„ظ‰ ط§ظ„ظ…ط§ظƒظٹظ†ط©',
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to start assignment:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¨ط¯ط، ط§ظ„ط¹ظ…ظ„' });
    }
});

// Update parts used
router.put('/:id/update-parts', authenticateToken, async (req, res) => {
    try {
        const { usedParts, totalCost } = req.body;

        const assignment = await db.serviceAssignment.findUnique({
            where: { id: req.params.id }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'ط§ظ„طھط¹ظٹظٹظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        const result = await db.$transaction(async (tx) => {
            const updated = await tx.serviceAssignment.update({
                where: { id: req.params.id },
                data: {
                    usedParts: JSON.stringify(usedParts),
                    totalCost: totalCost || 0
                }
            });

            // Log
            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: req.params.id,
                    action: 'PARTS_ADDED',
                    details: `طھظ… طھط­ط¯ظٹط« ظ‚ط·ط¹ ط§ظ„ط؛ظٹط§ط± - ط§ظ„ط¥ط¬ظ…ط§ظ„ظٹ: ${totalCost || 0} ط¬.ظ…`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to update parts:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ظ‚ط·ط¹' });
    }
});

// Request approval from branch
router.post('/:id/request-approval', authenticateToken, async (req, res) => {
    try {
        const { requestedParts, totalRequestedCost } = req.body;

        const assignment = await db.serviceAssignment.findUnique({
            where: { id: req.params.id }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'ط§ظ„طھط¹ظٹظٹظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        const result = await db.$transaction(async (tx) => {
            // Create approval request
            const approvalRequest = await tx.serviceApprovalRequest.create({
                data: {
                    assignmentId: assignment.id,
                    machineSerial: assignment.serialNumber,
                    customerId: assignment.customerId || '',
                    customerName: assignment.customerName || '',
                    requestedParts: JSON.stringify(requestedParts),
                    totalRequestedCost,
                    centerBranchId: assignment.branchId,
                    targetBranchId: assignment.originBranchId
                }
            });

            // Update assignment
            const updated = await tx.serviceAssignment.update({
                where: { id: req.params.id },
                data: {
                    status: 'PENDING_APPROVAL',
                    approvalStatus: 'PENDING',
                    approvalRequestId: approvalRequest.id,
                    usedParts: JSON.stringify(requestedParts),
                    totalCost: totalRequestedCost
                }
            });

            // Update machine status
            await tx.warehouseMachine.update({
                where: { id: assignment.machineId },
                data: { status: 'PENDING_APPROVAL' }
            });

            // Log
            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: req.params.id,
                    action: 'APPROVAL_SENT',
                    details: `طھظ… ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ظ…ظˆط§ظپظ‚ط© ط¨ظ‚ظٹظ…ط© ${totalRequestedCost} ط¬.ظ…`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return { updated, approvalRequest };
        });

        // Build parts list for notification
        const partsNames = requestedParts.map(p => p.name).join('طŒ ');

        // Notify the origin branch
        await createNotification({
            branchId: assignment.originBranchId,
            type: 'APPROVAL_REQUEST',
            title: 'âڑ ï¸ڈ ط·ظ„ط¨ ظ…ظˆط§ظپظ‚ط© طµظٹط§ظ†ط©',
            message: `ط§ظ„ظ…ط§ظƒظٹظ†ط© ${assignment.serialNumber} ظ„ظ„ط¹ظ…ظٹظ„ ${assignment.customerName || 'ط؛ظٹط± ظ…ط­ط¯ط¯'} طھط­طھط§ط¬ ظ…ظˆط§ظپظ‚ط© ط¨ظ‚ظٹظ…ط© ${totalRequestedCost} ط¬.ظ… - ط§ظ„ظ‚ط·ط¹: ${partsNames}`,
            link: '/maintenance-approvals',
            data: JSON.stringify({ assignmentId: assignment.id })
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to request approval:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¥ط±ط³ط§ظ„ ط·ظ„ط¨ ط§ظ„ظ…ظˆط§ظپظ‚ط©' });
    }
});

// Complete assignment
router.put('/:id/complete', authenticateToken, async (req, res) => {
    try {
        const { actionTaken, resolution } = req.body;

        const assignment = await db.serviceAssignment.findUnique({
            where: { id: req.params.id },
            include: { machine: true }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'ط§ظ„طھط¹ظٹظٹظ† ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        // Check if approval was needed but not received
        if (assignment.totalCost > 0 &&
            assignment.approvalStatus === 'PENDING') {
            return res.status(400).json({ error: 'ظٹط¬ط¨ ط§ظ†طھط¸ط§ط± ظ…ظˆط§ظپظ‚ط© ط§ظ„ظپط±ط¹' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update assignment
            const updated = await tx.serviceAssignment.update({
                where: { id: req.params.id },
                data: {
                    status: 'COMPLETED',
                    actionTaken,
                    resolution: resolution || 'REPAIRED',
                    completedAt: new Date()
                }
            });

            // Update machine status
            await tx.warehouseMachine.update({
                where: { id: assignment.machineId },
                data: {
                    status: 'READY_FOR_RETURN',
                    resolution: resolution || 'REPAIRED'
                }
            });

            // If there's a cost, create pending payment
            if (assignment.totalCost > 0 && assignment.approvalStatus === 'APPROVED') {
                await tx.pendingPayment.create({
                    data: {
                        assignmentId: assignment.id,
                        machineSerial: assignment.serialNumber,
                        customerId: assignment.customerId || '',
                        customerName: assignment.customerName || '',
                        amount: assignment.totalCost,
                        partsDetails: assignment.usedParts || '[]',
                        centerBranchId: assignment.branchId,
                        targetBranchId: assignment.originBranchId
                    }
                });
            }

            // Deduct parts from inventory
            if (assignment.usedParts) {
                const parts = JSON.parse(assignment.usedParts);
                for (const part of parts) {
                    // Find inventory item
                    const invItem = await tx.inventoryItem.findFirst({
                        where: {
                            partId: part.partId,
                            branchId: assignment.branchId
                        }
                    });

                    if (invItem && invItem.quantity >= part.quantity) {
                        await tx.inventoryItem.update({
                            where: { id: invItem.id },
                            data: {
                                quantity: { decrement: part.quantity }
                            }
                        });

                        // Log stock movement
                        await tx.stockMovement.create({
                            data: {
                                partId: part.partId,
                                type: 'OUT',
                                quantity: part.quantity,
                                reason: `طµظٹط§ظ†ط© ظ…ط§ظƒظٹظ†ط© ${assignment.serialNumber}`,
                                requestId: assignment.requestId,
                                performedBy: req.user.displayName || req.user.email,
                                branchId: assignment.branchId
                            }
                        });
                    }
                }
            }

            // Log
            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: req.params.id,
                    action: 'COMPLETED',
                    details: `طھظ… ط¥ظƒظ…ط§ظ„ ط§ظ„طµظٹط§ظ†ط© - ${resolution || 'REPAIRED'}`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to complete assignment:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¥ظƒظ…ط§ظ„ ط§ظ„طµظٹط§ظ†ط©' });
    }
});

// Get machines assigned to current user
router.get('/my-assignments', authenticateToken, async (req, res) => {
    try {
        const assignments = await db.serviceAssignment.findMany({
            where: {
                technicianId: req.user.id,
                status: { not: 'RETURNED' }
            },
            include: {
                machine: true,
                logs: {
                    orderBy: { performedAt: 'desc' },
                    take: 3
                }
            },
            orderBy: { assignedAt: 'desc' }
        });

        res.json(assignments);
    } catch (error) {
        console.error('Failed to fetch my assignments:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ طھط¹ظٹظٹظ†ط§طھظٹ' });
    }
});

module.exports = router;
