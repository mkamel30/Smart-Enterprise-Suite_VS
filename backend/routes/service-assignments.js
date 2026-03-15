const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { ROLES, isGlobalRole } = require('../utils/constants');

/**
 * GET /api/service-assignments
 * Get all assignments for the center (branch-scoped)
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { branchId, status, technicianId } = req.query;
    const where = {};

    // Allow global roles to filter by branchId, otherwise it's scoped by extension/context
    if (branchId && isGlobalRole(req.user.role)) {
        where.branchId = branchId;
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

    return success(res, assignments);
}));

/**
 * GET /api/service-assignments/:id
 * Get single assignment
 */
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const assignment = await db.serviceAssignment.findFirst({
        where: { id: req.params.id },
        include: {
            machine: true,
            logs: {
                orderBy: { performedAt: 'desc' }
            }
        }
    });

    if (!assignment) return error(res, 'التعيين غير موجود', 404);

    return success(res, assignment);
}));

/**
 * POST /api/service-assignments
 * Create new assignment (assign technician to machine)
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
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
    const machine = await db.warehouseMachine.findFirst({
        where: { id: machineId, branchId }
    });

    if (!machine) return error(res, 'الماكينة غير موجودة', 404);

    const result = await db.$transaction(async (tx) => {
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

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId },
            data: {
                status: 'ASSIGNED',
                currentAssignmentId: assignment.id,
                currentTechnicianId: technicianId,
                currentTechnicianName: technicianName
            }
        });

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

    return success(res, result, 201);
}));

/**
 * PUT /api/service-assignments/:id/start
 */
router.put('/:id/start', authenticateToken, asyncHandler(async (req, res) => {
    const assignment = await db.serviceAssignment.findFirst({
        where: { id: req.params.id }
    });

    if (!assignment) return error(res, 'التعيين غير موجود', 404);

    const result = await db.$transaction(async (tx) => {
        await tx.serviceAssignment.updateMany({
            where: { id: req.params.id, branchId: assignment.branchId },
            data: {
                status: 'IN_PROGRESS',
                startedAt: new Date()
            }
        });

        const updated = await tx.serviceAssignment.findFirst({
            where: { id: req.params.id, branchId: assignment.branchId }
        });

        await tx.warehouseMachine.updateMany({
            where: { id: assignment.machineId, branchId: assignment.branchId },
            data: { status: 'IN_PROGRESS' }
        });

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

    return success(res, result);
}));

/**
 * PUT /api/service-assignments/:id/update-parts
 */
router.put('/:id/update-parts', authenticateToken, asyncHandler(async (req, res) => {
    const { usedParts, totalCost } = req.body;
    const assignment = await db.serviceAssignment.findFirst({
        where: { id: req.params.id }
    });

    if (!assignment) return error(res, 'التعيين غير موجود', 404);

    const result = await db.$transaction(async (tx) => {
        await tx.serviceAssignment.updateMany({
            where: { id: req.params.id, branchId: assignment.branchId },
            data: {
                usedParts: JSON.stringify(usedParts),
                totalCost: totalCost || 0
            }
        });

        const updated = await tx.serviceAssignment.findFirst({
            where: { id: req.params.id, branchId: assignment.branchId }
        });

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

    return success(res, result);
}));

/**
 * POST /api/service-assignments/:id/request-approval
 */
router.post('/:id/request-approval', authenticateToken, asyncHandler(async (req, res) => {
    const { requestedParts, totalRequestedCost } = req.body;
    const assignment = await db.serviceAssignment.findFirst({
        where: { id: req.params.id }
    });

    if (!assignment) return error(res, 'التعيين غير موجود', 404);

    const result = await db.$transaction(async (tx) => {
        const approvalRequest = await tx.maintenanceApprovalRequest.create({
            data: {
                assignmentId: assignment.id,
                machineSerial: assignment.serialNumber,
                customerId: assignment.customerId || '',
                customerName: assignment.customerName || '',
                proposedParts: JSON.stringify(requestedParts),
                proposedTotal: totalRequestedCost,
                centerBranchId: assignment.branchId,
                originBranchId: assignment.originBranchId
            }
        });

        await tx.serviceAssignment.updateMany({
            where: { id: req.params.id, branchId: assignment.branchId },
            data: {
                status: 'PENDING_APPROVAL',
                approvalStatus: 'PENDING',
                approvalRequestId: approvalRequest.id,
                usedParts: JSON.stringify(requestedParts),
                totalCost: totalRequestedCost
            }
        });

        const updated = await tx.serviceAssignment.findFirst({
            where: { id: req.params.id, branchId: assignment.branchId }
        });

        await tx.warehouseMachine.updateMany({
            where: { id: assignment.machineId, branchId: assignment.branchId },
            data: { status: 'PENDING_APPROVAL' }
        });

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

    const partsNames = requestedParts.map(p => p.name).join('، ');
    await createNotification({
        branchId: assignment.originBranchId,
        type: 'APPROVAL_REQUEST',
        title: '⚠️ طلب موافقة صيانة',
        message: `الماكينة ${assignment.serialNumber} للعميل ${assignment.customerName || 'غير محدد'} تحتاج موافقة بقيمة ${totalRequestedCost} ج.م - القطع: ${partsNames}`,
        link: '/maintenance-approvals',
        data: JSON.stringify({ assignmentId: assignment.id })
    });

    return success(res, result);
}));

/**
 * PUT /api/service-assignments/:id/complete
 */
router.put('/:id/complete', authenticateToken, asyncHandler(async (req, res) => {
    const { actionTaken, resolution } = req.body;
    const assignment = await db.serviceAssignment.findFirst({
        where: { id: req.params.id },
        include: { machine: true }
    });

    if (!assignment) return error(res, 'التعيين غير موجود', 404);

    if (assignment.totalCost > 0 && assignment.approvalStatus === 'PENDING') {
        return error(res, 'يجب انتظار موافقة الفرع', 400);
    }

    const result = await db.$transaction(async (tx) => {
        await tx.serviceAssignment.updateMany({
            where: { id: req.params.id, branchId: assignment.branchId },
            data: {
                status: 'COMPLETED',
                actionTaken,
                resolution: resolution || 'REPAIRED',
                completedAt: new Date()
            }
        });

        const updated = await tx.serviceAssignment.findFirst({
            where: { id: req.params.id, branchId: assignment.branchId }
        });

        await tx.warehouseMachine.updateMany({
            where: { id: assignment.machineId, branchId: assignment.branchId },
            data: {
                status: 'READY_FOR_RETURN',
                resolution: resolution || 'REPAIRED'
            }
        });

        if (assignment.totalCost > 0 && assignment.approvalStatus === 'APPROVED') {
            await tx.branchDebt.create({
                data: {
                    type: 'MAINTENANCE',
                    referenceId: assignment.id,
                    machineSerial: assignment.serialNumber,
                    customerId: assignment.customerId || '',
                    customerName: assignment.customerName || '',
                    amount: assignment.totalCost,
                    remainingAmount: assignment.totalCost,
                    partsDetails: assignment.usedParts || '[]',
                    creditorBranchId: assignment.branchId,
                    debtorBranchId: assignment.originBranchId,
                    status: 'PENDING'
                }
            });
        }

        if (assignment.usedParts) {
            const parts = JSON.parse(assignment.usedParts);
            for (const part of parts) {
                const invItem = await tx.inventoryItem.findFirst({
                    where: {
                        partId: part.partId,
                        branchId: assignment.branchId
                    }
                });

                if (invItem && invItem.quantity >= part.quantity) {
                    await tx.inventoryItem.updateMany({
                        where: { id: invItem.id, branchId: assignment.branchId },
                        data: {
                            quantity: { decrement: part.quantity }
                        }
                    });

                    await tx.stockMovement.create({
                        data: {
                            partId: part.partId,
                            type: 'OUT',
                            quantity: part.quantity,
                            reason: `صيانة ماكينة ${assignment.serialNumber}`,
                            requestId: assignment.requestId,
                            performedBy: req.user.displayName || req.user.email,
                            userId: req.user.id,
                            branchId: assignment.branchId,
                            isPaid: assignment.totalCost > 0
                        }
                    });
                }
            }
        }

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

    return success(res, result);
}));

/**
 * GET /api/service-assignments/my-assignments
 */
router.get('/my-assignments', authenticateToken, asyncHandler(async (req, res) => {
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

    return success(res, assignments);
}));

module.exports = router;
