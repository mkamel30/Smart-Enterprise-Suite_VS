const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { createNotification } = require('../system/notifications.routes.js');
const { authenticateToken } = require('../../../middleware/auth');
const { logAction } = require('../../../utils/logger');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { roundMoney } = require('../finance/payment.service.js');
const { isGlobalRole, ROLES } = require('../../../utils/constants');

/**
 * GET /request/:requestId
 * Get approval by Request ID
 */
router.get('/request/:requestId', authenticateToken, asyncHandler(async (req, res) => {
    const approval = await db.maintenanceApproval.findFirst({
        where: { requestId: req.params.requestId }
    });

    if (!approval) return error(res, 'Approval not found', 404);

    // Authorization check
    const isAdmin = isGlobalRole(req.user?.role);
    if (!isAdmin && approval.branchId !== req.user.branchId) {
        return error(res, 'Access denied', 403);
    }

    return success(res, approval);
}));

/**
 * POST /
 * Create Approval Request (Center -> Branch)
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    const { requestId, cost, parts, notes } = req.body;

    const request = await db.maintenanceRequest.findUnique({
        where: { id: requestId }
    });

    if (!request) return error(res, 'Request not found', 404);

    // Authorization check
    const isAdmin = isGlobalRole(req.user?.role);
    if (!isAdmin && request.branchId !== req.user.branchId) {
        return error(res, 'Access denied', 403);
    }

    // ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
    const approval = await db.$transaction(async (tx) => {
        // 1. Create approval
        const newApproval = await tx.maintenanceApproval.create({
            data: {
                requestId,
                cost: roundMoney(cost),
                parts: JSON.stringify(parts),
                notes,
                status: 'PENDING',
                branchId: request.branchId
            }
        });

        // 2. Update Request Status
        await tx.maintenanceRequest.update({
            where: { id: requestId },
            data: { status: 'WAITING_APPROVAL' }
        });

        return newApproval;
    });

    // Log approval creation (AFTER transaction)
    await logAction({
        entityType: 'MAINTENANCE_APPROVAL',
        entityId: approval.id,
        action: 'CREATE',
        details: `ÅäÔÇÁ ØáÈ ãæÇÝÞÉ - ÇáÊßáÝÉ: ${roundMoney(cost)} - ÇáØáÈ: ${requestId}`,
        userId: req.user?.id,
        performedBy: req.user?.displayName || 'System',
        branchId: request.branchId
    });

    // Notify Branch
    if (request.branchId) {
        await createNotification({
            branchId: request.branchId,
            type: 'APPROVAL_REQUEST',
            title: 'ØáÈ ãæÇÝÞÉ Úáì ÕíÇäÉ',
            message: `ãØáæÈ ãæÇÝÞÉ Úáì ÊßáÝÉ ÕíÇäÉ ááØáÈ ÑÞã ${requestId} ÈÞíãÉ ${cost}`,
            data: { requestId, approvalId: approval.id },
            link: `/requests/${requestId}`
        });
    }

    return success(res, approval, 201);
}));

/**
 * PUT /:id/respond
 * Respond to Approval (Branch -> Center)
 */
router.put('/:id/respond', authenticateToken, asyncHandler(async (req, res) => {
    const { status, responseNotes } = req.body; // APPROVED, REJECTED
    const { id } = req.params;
    const responderName = req.user?.displayName || 'Admin';

    const previousApproval = await db.maintenanceApproval.findUnique({
        where: { id }
    });

    if (!previousApproval) return error(res, 'Approval not found', 404);

    // Authorization check
    const isAdmin = isGlobalRole(req.user?.role);
    if (!isAdmin && previousApproval.branchId !== req.user.branchId) {
        return error(res, 'Access denied', 403);
    }

    // ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
    const result = await db.$transaction(async (tx) => {
        // 1. Update approval
        await tx.maintenanceApproval.update({
            where: { id },
            data: {
                status,
                respondedAt: new Date(),
                respondedBy: responderName,
                notes: responseNotes ? `${previousApproval?.notes || ''}\nResponse: ${responseNotes}` : undefined
            }
        });

        // 2. Update Request Status
        await tx.maintenanceRequest.update({
            where: { id: previousApproval.requestId },
            data: { status: status === 'APPROVED' ? 'AT_CENTER' : 'CANCELLED' }
        });

        // Load final state
        return tx.maintenanceApproval.findUnique({
            where: { id },
            include: { request: true }
        });
    });

    // Log approval response (AFTER transaction)
    await logAction({
        entityType: 'MAINTENANCE_APPROVAL',
        entityId: id,
        action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
        details: `${status === 'APPROVED' ? 'ãæÇÝÞÉ' : 'ÑÝÖ'} Úáì ÇáÕíÇäÉ - ÇáØáÈ: ${previousApproval.requestId}${responseNotes ? ' - ' + responseNotes : ''}`,
        userId: req.user?.id,
        performedBy: responderName,
        branchId: previousApproval?.branchId
    });

    // Notify Center
    if (result.request && result.request.servicedByBranchId) {
        await createNotification({
            branchId: result.request.servicedByBranchId,
            type: 'APPROVAL_RESPONSE',
            title: `Êã ${status === 'APPROVED' ? 'ÇáãæÇÝÞÉ Úáì' : 'ÑÝÖ'} ÇáÕíÇäÉ`,
            message: `Êã ÇáÑÏ Úáì ØáÈ ÇáãæÇÝÞÉ ááØáÈ ${result.requestId}`,
            data: { requestId: result.requestId },
            link: `/requests/${previousApproval.requestId}`
        });
    }

    return success(res, result);
}));

module.exports = router;
