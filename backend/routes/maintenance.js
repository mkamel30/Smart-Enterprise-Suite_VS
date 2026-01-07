const express = require('express');
const router = express.Router();
const db = require('../db');
const maintenanceService = require('../services/maintenanceService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
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
router.get('/shipments', authenticateToken, asyncHandler(async (req, res) => {
  const result = await maintenanceService.getShipments(req.query, req.user);
  res.json(result);
}));

// POST /shipments/:id/receive - Confirm Receipt of Batch
router.post('/shipments/:id/receive', authenticateToken, asyncHandler(async (req, res) => {
  const result = await maintenanceService.receiveShipment(req.params.id, req.user);
  res.json({ success: true, message: 'Shipment received successfully', order: result });
}));


// --- 2. MACHINE WORKFLOW (transitions) ---

// POST /machine/:serial/transition
router.post('/machine/:serial/transition', authenticateToken, asyncHandler(async (req, res) => {
  const { serial } = req.params;
  const { action, data } = req.body;
  const result = await maintenanceService.transitionMachine(serial, action, data, req.user);

  // Log workflow transition (AFTER successful service call)
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
}));

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
    await validateRequest(schema)({ body: req.body }, res, () => { });

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
