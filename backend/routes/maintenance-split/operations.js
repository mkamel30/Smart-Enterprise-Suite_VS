const express = require('express');
const router = express.Router();
const maintenanceService = require('../../services/maintenanceService');
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { success, error } = require('../../utils/apiResponse');
const { ROLES } = require('../../utils/constants');
const asyncHandler = require('../../utils/asyncHandler');
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
} = require('../../validation/schemas/maintenance');


/**
 * POST /assignments
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

        return success(res, assignment, 201);
    })
);

/**
 * GET /assignments
 * Get assignments with filters (branch-scoped)
 */
router.get(
    '/assignments',
    authenticateToken,
    validateRequest(GetAssignmentsSchema),
    asyncHandler(async (req, res) => {
        const result = await maintenanceService.getAssignments(req.query, req.user);
        return success(res, result);
    })
);

/**
 * POST /approval-request
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

        return success(res, approvalRequest, 201);
    })
);

/**
 * POST /complete-direct
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

        return success(res, result);
    })
);

/**
 * POST /complete-after-approval
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

        return success(res, result);
    })
);

/**
 * POST /approvals/:id/respond
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

        return success(res, assignment);
    })
);

/**
 * GET /approval-requests
 * Get approval requests (branch-scoped)
 */
router.get(
    '/approval-requests',
    authenticateToken,
    validateRequest(GetApprovalRequestsSchema),
    asyncHandler(async (req, res) => {
        const result = await maintenanceService.getApprovalRequests(req.query, req.user);
        return success(res, result);
    })
);

/**
 * GET /debts
 * Get branch debts (branch-scoped)
 */
router.get(
    '/debts',
    authenticateToken,
    validateRequest(GetBranchDebtsSchema),
    asyncHandler(async (req, res) => {
        const result = await maintenanceService.getBranchDebts(req.query, req.user);
        return success(res, result);
    })
);

/**
 * POST /debts/payment
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

        return success(res, debt);
    })
);

/**
 * GET /tracking/export
 * Export tracked machines to Excel
 */
router.get('/tracking/export', authenticateToken, asyncHandler(async (req, res) => {
    const assignments = await maintenanceService.getAssignments(req.query, req.user);

    const data = (assignments.assignments || assignments).map(a => ({
        'تاريخ التعيين': new Date(a.assignedAt || a.createdAt).toLocaleDateString('ar-EG'),
        'السيريال': a.serialNumber || '-',
        'العميل': a.customerName || '-',
        'الفني': a.technicianName || '-',
        'الحالة': a.status || '-',
        'التكلفة': a.totalCost || 0,
        'تاريخ البدء': a.startedAt ? new Date(a.startedAt).toLocaleDateString('ar-EG') : '-',
        'تاريخ الانتهاء': a.completedAt ? new Date(a.completedAt).toLocaleDateString('ar-EG') : '-'
    }));

    const columns = [
        { header: 'تاريخ التعيين', key: 'تاريخ التعيين', width: 15 },
        { header: 'السيريال', key: 'السيريال', width: 20 },
        { header: 'العميل', key: 'العميل', width: 25 },
        { header: 'الفني', key: 'الفني', width: 20 },
        { header: 'الحالة', key: 'الحالة', width: 15 },
        { header: 'التكلفة', key: 'التكلفة', width: 12 },
        { header: 'تاريخ البدء', key: 'تاريخ البدء', width: 15 },
        { header: 'تاريخ الانتهاء', key: 'تاريخ الانتهاء', width: 15 }
    ];

    const buffer = await exportToExcel(data, columns, 'tracking_export');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=tracking_export.xlsx');
    res.send(buffer);
}));

module.exports = router;
