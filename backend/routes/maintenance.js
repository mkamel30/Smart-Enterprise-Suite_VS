const express = require('express');
const router = express.Router();
const db = require('../db');
const maintenanceService = require('../services/maintenanceService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../validation/middleware');
const asyncHandler = require('../utils/asyncHandler');
const {
  CreateAssignmentSchema,
  RequestApprovalSchema,
  CompleteDirectSchema,
  CompleteAfterApprovalSchema,
  ApproveSchema,
  RejectSchema,
  RecordPaymentSchema,
  GetAssignmentsSchema,
  GetApprovalRequestsSchema,
  GetBranchDebtsSchema,
} = require('../validation/schemas/maintenance');
const { logAction } = require('../utils/logger');
const { getBranchFilter } = require('../utils/auth-helpers');
const { createNotification } = require('./notifications');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// --- 1. SHIPMENT MANAGEMENT ---

// GET /shipments - Fetch incoming batches (TransferOrders)
router.get('/shipments', authenticateToken, async (req, res) => {
    try {
        const { status } = req.query;
        // Logic: Users in Maintenance Center see shipments TO their branch
        // Filter by 'SEND_TO_CENTER' type

        const branchId = req.user.branchId;
        const userRole = req.user.role;

        // Allow Admins to view all or filter
        const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(userRole) || !branchId;

        const where = {
            type: { in: ['SEND_TO_CENTER', 'MAINTENANCE'] },
        };

        if (!isAdmin) {
            where.toBranchId = branchId;
        } else if (req.query.branchId) {
            // Admin filtering by specific center
            where.toBranchId = req.query.branchId;
        }

        if (status && status !== 'ALL') {
            where.status = status;
        } else if (!status) {
            // Default: Show Pending and Accepted (Received) - Active workflows
            where.status = { in: ['PENDING', 'ACCEPTED', 'RECEIVED'] };
        }
        // If status === 'ALL', we don't set where.status, so it fetches everything

        const allowUnscoped = (!branchId) || ['SUPER_ADMIN', 'MANAGEMENT'].includes(userRole);
        // Add a branch-aware scope to satisfy branch enforcement while keeping toBranch filter
        const branchScope = branchId ? { OR: [{ branchId }, { toBranchId: branchId }, { fromBranchId: branchId }] } : {};

        const shipments = await db.transferOrder.findMany({
            where: {
                ...where,
                ...branchScope
            },
            include: {
                fromBranch: { select: { name: true, code: true } },
                items: {
                    select: {
                        serialNumber: true,
                        model: true,
                        manufacturer: true,
                        type: true,
                        // We might want to join WarehouseMachine to get current status
                    }
                },
                _count: { select: { items: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        // Enrich with WarehouseMachine status for each item
        // This acts as a 'smart' view to show updated status of machines within shipment
        const enrichedShipments = await Promise.all(shipments.map(async (shipment) => {
            const serials = shipment.items.map(i => i.serialNumber);
            const machines = await db.warehouseMachine.findMany(ensureBranchWhere({
                where: { serialNumber: { in: serials } },
                select: { serialNumber: true, status: true, resolution: true }
            }, req));

            // Calculate progress?
            const completedCount = machines.filter(m =>
                ['REPAIRED', 'SCRAPPED', 'RETURNED_AS_IS', 'READY_FOR_DELIVERY', 'IN_RETURN_TRANSIT'].includes(m.status) ||
                m.resolution
            ).length;

            return {
                ...shipment,
                machineStatuses: machines,
                progress: Math.round((completedCount / shipment.items.length) * 100) || 0
            };
        }));

        res.json(enrichedShipments);
    } catch (error) {
        console.error('Failed to fetch shipments:', error);
        res.status(500).json({ error: 'Failed to fetch shipments' });
    }
});

// POST /shipments/:id/receive - Confirm Receipt of Batch
router.post('/shipments/:id/receive', authenticateToken, async (req, res) => {
    const { id } = req.params;
    try {
        await db.$transaction(async (tx) => {
            // 1. Update TransferOrder
            const order = await tx.transferOrder.update({
                where: { id },
                data: {
                    status: 'ACCEPTED', // or RECEIVED
                    receivedByUserId: req.user.id,
                    receivedBy: req.user.displayName,
                    receivedAt: new Date()
                },
                include: { items: true }
            });

            // 2. Update Machines Status
            for (const item of order.items) {
                await tx.warehouseMachine.update({
                    where: { serialNumber: item.serialNumber },
                    data: {
                        status: 'RECEIVED_AT_CENTER',
                        branchId: req.user.branchId
                    }
                });

                // Log movement
                await tx.machineMovementLog.create({
                    data: {
                        serialNumber: item.serialNumber,
                        action: 'RECEIVED_AT_CENTER',
                        performedBy: req.user.displayName,
                        branchId: req.user.branchId,
                        details: `Received in Shipment #${order.orderNumber}`
                    }
                });
            }
        });

        res.json({ success: true, message: 'Shipment received successfully' });
    } catch (error) {
        console.error('Failed to receive shipment:', error);
        res.status(500).json({ error: 'Failed to receive shipment' });
    }
});


// --- 2. MACHINE WORKFLOW (transitions) ---

// POST /machine/:serial/transition
router.post('/machine/:serial/transition', authenticateToken, async (req, res) => {
    const { serial } = req.params;
    const { action, data } = req.body;
    // action: 'INSPECT', 'REQUEST_APPROVAL', 'REPAIR', 'SCRAP'
    // data: { notes, proposedParts, usedParts, cost }

    try {
        // findUnique يجب أن يستخدم حقل فريد فقط (serialNumber) ثم نتحقق من الفرع يدوياً
        const machine = await db.warehouseMachine.findUnique({ where: { serialNumber: serial } });
        if (!machine) return res.status(404).json({ error: 'Machine not found' });

        // تحقق صلاحيات الوصول: يسمح لمركز الصيانة أو لنفس فرع الماكينة (branchId أو originBranchId)
        const userBranchId = req.user.branchId;
        const isCenterRole = ['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);
        const sameBranch = userBranchId && (machine.branchId === userBranchId || machine.originBranchId === userBranchId);
        if (userBranchId && !isCenterRole && !sameBranch) {
            return res.status(403).json({ error: 'Access denied for this machine' });
        }

        // ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
        const result = await db.$transaction(async (tx) => {
            let updateData = {};
            let newStatus = machine.status;
            let logActionType = action;
            let approval = null;
            let activeRequest = null;

            if (action === 'INSPECT') {
                newStatus = 'UNDER_INSPECTION';
                updateData = { status: newStatus };
            }
            else if (action === 'REQUEST_APPROVAL') {
                newStatus = 'AWAITING_APPROVAL';
                // Store Quote
                updateData = {
                    status: newStatus,
                    proposedRepairNotes: data.notes,
                    proposedParts: JSON.stringify(data.parts || []),
                    proposedTotalCost: parseFloat(data.cost || 0)
                };

                // 1. Find or Create Active Request to attach Approval to
                activeRequest = await tx.maintenanceRequest.findFirst(ensureBranchWhere({
                    where: {
                        serialNumber: serial,
                        status: { in: ['Open', 'In Progress', 'PENDING_TRANSFER'] }
                    }
                }, req));

                if (!activeRequest) {
                    activeRequest = await tx.maintenanceRequest.create({
                        data: {
                            branchId: machine.originBranchId || machine.branchId,
                            serialNumber: serial,
                            customerName: machine.originalOwnerId ? 'Client ' + machine.originalOwnerId : 'Unknown',
                            type: 'MAINTENANCE',
                            status: 'Open',
                            description: 'Generated during Center Inspection',
                            createdBy: req.user.id
                        }
                    });
                }

                // 2. Create the Approval Record
                approval = await tx.maintenanceApproval.create({
                    data: {
                        requestId: activeRequest.id,
                        branchId: activeRequest.branchId,
                        parts: JSON.stringify(data.parts || []),
                        cost: parseFloat(data.cost || 0),
                        notes: data.notes,
                        status: 'PENDING'
                    }
                });
            }
            else if (action === 'REPAIR') {
                // Finalize
                newStatus = 'REPAIRED';

                updateData = {
                    status: newStatus,
                    resolution: 'REPAIRED',
                    repairNotes: data.notes,
                    usedParts: JSON.stringify(data.parts || []),
                    totalCost: parseFloat(data.cost || 0),
                    proposedParts: null,
                    proposedTotalCost: null
                };
                // Logic to deduct inventory would go here inside transaction
            }
            else if (action === 'SCRAP') {
                newStatus = 'SCRAPPED';
                updateData = {
                    status: newStatus,
                    resolution: 'SCRAPPED',
                    repairNotes: data.notes
                };
            }

            // Update machine status
            const updatedMachine = await tx.warehouseMachine.update({
                where: { serialNumber: serial },
                data: updateData
            });

            return { updatedMachine, approval, activeRequest, newStatus, logActionType };
        });

        // Log workflow transition (AFTER transaction)
        await logAction({
            entityType: 'WAREHOUSE_MACHINE',
            entityId: serial,
            action: result.logActionType,
            details: `Workflow transition: ${result.logActionType} - Status: ${result.newStatus}${data.notes ? ' - ' + data.notes : ''}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: req.user?.branchId
        });

        res.json({ success: true, machine: result.updatedMachine, approval: result.approval });

    } catch (error) {
        console.error('Workflow transition failed:', error);
        res.status(500).json({ error: 'Transition failed' });
    }
});

// ============================================
// NEW MAINTENANCE WORKFLOW ROUTES
// (Service Assignments, Approvals, Debts)
// ============================================

/**
 * POST /api/maintenance/assignments
 * Create service assignment (تعيين مختص)
 */
router.post(
  '/assignments',
  authenticateToken,
  validateRequest(CreateAssignmentSchema),
  asyncHandler(async (req, res) => {
    const assignment = await maintenanceService.createAssignment(req.body, req.user);

    // Emit Socket.IO event
    if (req.app.get('io')) {
      req.app.get('io').to(`user_${req.body.technicianId}`).emit('maintenance:assigned', {
        assignmentId: assignment.id,
        machineSerial: assignment.serialNumber,
        customerName: assignment.customerName,
        message: `🔧 تم تعيينك للماكينة ${assignment.serialNumber}`,
      });
    }

    res.status(201).json(assignment);
  })
);

/**
 * GET /api/maintenance/assignments
 * Get assignments with filters (branch-scoped)
 */
router.get(
  '/assignments',
  authenticateToken,
  validateRequest(GetAssignmentsSchema),
  asyncHandler(async (req, res) => {
    const result = await maintenanceService.getAssignments(req.query, req.user);
    res.json(result);
  })
);

/**
 * POST /api/maintenance/approval-request
 * Request approval (Quote - NO stock deduction)
 */
router.post(
  '/approval-request',
  authenticateToken,
  validateRequest(RequestApprovalSchema),
  asyncHandler(async (req, res) => {
    const approvalRequest = await maintenanceService.requestApproval(req.body, req.user);

    // Emit Socket.IO event
    if (req.app.get('io')) {
      req.app.get('io').to(`branch_${req.body.originBranchId}`).emit('maintenance:approval-requested', {
        approvalRequestId: approvalRequest.id,
        assignmentId: req.body.assignmentId,
        machineSerial: req.body.machineSerial,
        customerName: req.body.customerName,
        proposedTotal: approvalRequest.proposedTotal,
        centerBranchId: req.body.centerBranchId,
        message: `⚠️ طلب موافقة صيانة: ${req.body.machineSerial} للعميل ${req.body.customerName} - ${approvalRequest.proposedTotal} ج.م`,
      });
    }

    res.status(201).json(approvalRequest);
  })
);

/**
 * POST /api/maintenance/complete-direct
 * Complete direct maintenance (immediate stock deduction)
 */
router.post(
  '/complete-direct',
  authenticateToken,
  validateRequest(CompleteDirectSchema),
  asyncHandler(async (req, res) => {
    const result = await maintenanceService.completeDirect(req.body, req.user);

    // Emit Socket.IO event
    if (req.app.get('io')) {
      const assignment = result.assignment;
      req.app.get('io').to(`branch_${assignment.originBranchId}`).emit('maintenance:completed', {
        assignmentId: assignment.id,
        machineSerial: assignment.serialNumber,
        resolution: req.body.resolution,
        totalCost: assignment.totalCost,
        message: `✅ تمت الصيانة: ${assignment.serialNumber} - ${req.body.resolution}`,
      });
    }

    res.json(result);
  })
);

/**
 * POST /api/maintenance/complete-after-approval
 * Complete after approval (deduct stock NOW)
 */
router.post(
  '/complete-after-approval',
  authenticateToken,
  validateRequest(CompleteAfterApprovalSchema),
  asyncHandler(async (req, res) => {
    const result = await maintenanceService.completeAfterApproval(req.body, req.user);

    // Emit Socket.IO event
    if (req.app.get('io')) {
      const assignment = result.assignment;
      req.app.get('io').to(`branch_${assignment.originBranchId}`).emit('maintenance:completed', {
        assignmentId: assignment.id,
        machineSerial: assignment.serialNumber,
        resolution: req.body.resolution,
        totalCost: assignment.totalCost,
        message: `✅ تمت الصيانة بعد الموافقة: ${assignment.serialNumber} - ${req.body.resolution}`,
      });
    }

    res.json(result);
  })
);

/**
 * POST /api/maintenance/approvals/:id/respond
 * Approve or reject approval request
 */
router.post(
  '/approvals/:id/respond',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const approvalRequestId = req.params.id;

    // Validate based on status
    const schema = req.body.status === 'APPROVED' ? ApproveSchema : RejectSchema;
    await validateRequest(schema)({ body: req.body }, res, () => {});

    const assignment = await maintenanceService.respondApproval(approvalRequestId, req.body, req.user);

    // Emit Socket.IO event
    if (req.app.get('io')) {
      const message =
        req.body.status === 'APPROVED'
          ? `✅ تمت الموافقة على صيانة ${assignment.serialNumber}`
          : `❌ تم رفض طلب الموافقة للماكينة ${assignment.serialNumber}`;

      req.app.get('io').to(`branch_${assignment.centerBranchId}`).emit('maintenance:approval-responded', {
        assignmentId: assignment.id,
        machineSerial: assignment.serialNumber,
        status: req.body.status,
        rejectionReason: req.body.rejectionReason,
        message,
      });
    }

    res.json(assignment);
  })
);

/**
 * GET /api/maintenance/approval-requests
 * Get approval requests (branch-scoped)
 */
router.get(
  '/approval-requests',
  authenticateToken,
  validateRequest(GetApprovalRequestsSchema),
  asyncHandler(async (req, res) => {
    const result = await maintenanceService.getApprovalRequests(req.query, req.user);
    res.json(result);
  })
);

/**
 * GET /api/maintenance/debts
 * Get branch debts (branch-scoped)
 */
router.get(
  '/debts',
  authenticateToken,
  validateRequest(GetBranchDebtsSchema),
  asyncHandler(async (req, res) => {
    const result = await maintenanceService.getBranchDebts(req.query, req.user);
    res.json(result);
  })
);

/**
 * POST /api/maintenance/debts/payment
 * Record payment for debt (branch only)
 */
router.post(
  '/debts/payment',
  authenticateToken,
  validateRequest(RecordPaymentSchema),
  asyncHandler(async (req, res) => {
    const debt = await maintenanceService.recordPayment(req.body, req.user);

    // Emit Socket.IO event to creditor branch
    if (req.app.get('io')) {
      req.app.get('io').to(`branch_${debt.creditorBranchId}`).emit('maintenance:payment-recorded', {
        debtId: debt.id,
        amount: req.body.amount,
        receiptNumber: req.body.receiptNumber,
        remainingAmount: debt.remainingAmount,
        status: debt.status,
        message: `💰 تم تسجيل سداد ${req.body.amount} ج.م - إيصال: ${req.body.receiptNumber}`,
      });
    }

    res.json(debt);
  })
);

module.exports = router;
