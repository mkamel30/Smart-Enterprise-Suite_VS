const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
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
        res.status(500).json({ error: 'فشل في جلب التعيينات' });
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
            return res.status(404).json({ error: 'التعيين غير موجود' });
        }

        res.json(assignment);
    } catch (error) {
        console.error('Failed to fetch assignment:', error);
        res.status(500).json({ error: 'فشل في جلب التعيين' });
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
            return res.status(404).json({ error: 'الماكينة غير موجودة' });
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
                    details: `تم تعيين ${technicianName} للماكينة ${serialNumber || machine.serialNumber}`,
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
                title: 'تعيين جديد',
                message: `تم تعيينك لصيانة الماكينة ${serialNumber || machine.serialNumber}`,
                link: '/maintenance/shipments'
            });
        }

        res.status(201).json(result);
    } catch (error) {
        console.error('Failed to create assignment:', error);
        res.status(500).json({ error: 'فشل في إنشاء التعيين' });
    }
});

// Start working on assignment
router.put('/:id/start', authenticateToken, async (req, res) => {
    try {
        const assignment = await db.serviceAssignment.findUnique({
            where: { id: req.params.id }
        });

        if (!assignment) {
            return res.status(404).json({ error: 'التعيين غير موجود' });
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
                    details: 'بدأ العمل على الماكينة',
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to start assignment:', error);
        res.status(500).json({ error: 'فشل في بدء العمل' });
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
            return res.status(404).json({ error: 'التعيين غير موجود' });
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
                    details: `تم تحديث قطع الغيار - الإجمالي: ${totalCost || 0} ج.م`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to update parts:', error);
        res.status(500).json({ error: 'فشل في تحديث القطع' });
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
            return res.status(404).json({ error: 'التعيين غير موجود' });
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
                    details: `تم إرسال طلب موافقة بقيمة ${totalRequestedCost} ج.م`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return { updated, approvalRequest };
        });

        // Build parts list for notification
        const partsNames = requestedParts.map(p => p.name).join('، ');

        // Notify the origin branch
        await createNotification({
            branchId: assignment.originBranchId,
            type: 'APPROVAL_REQUEST',
            title: '⚠️ طلب موافقة صيانة',
            message: `الماكينة ${assignment.serialNumber} للعميل ${assignment.customerName || 'غير محدد'} تحتاج موافقة بقيمة ${totalRequestedCost} ج.م - القطع: ${partsNames}`,
            link: '/maintenance-approvals',
            data: JSON.stringify({ assignmentId: assignment.id })
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to request approval:', error);
        res.status(500).json({ error: 'فشل في إرسال طلب الموافقة' });
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
            return res.status(404).json({ error: 'التعيين غير موجود' });
        }

        // Check if approval was needed but not received
        if (assignment.totalCost > 0 &&
            assignment.approvalStatus === 'PENDING') {
            return res.status(400).json({ error: 'يجب انتظار موافقة الفرع' });
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
                                reason: `صيانة ماكينة ${assignment.serialNumber}`,
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
                    details: `تم إكمال الصيانة - ${resolution || 'REPAIRED'}`,
                    performedBy: req.user.displayName || req.user.email,
                    performedById: req.user.id
                }
            });

            return updated;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to complete assignment:', error);
        res.status(500).json({ error: 'فشل في إكمال الصيانة' });
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
        res.status(500).json({ error: 'فشل في جلب تعييناتي' });
    }
});

module.exports = router;
