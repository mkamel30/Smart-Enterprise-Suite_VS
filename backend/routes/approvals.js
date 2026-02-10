const express = require('express');
const router = express.Router();
const db = require('../db');
const { createNotification } = require('./notifications');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// Import roundMoney from centralized payment service
const { roundMoney } = require('../services/paymentService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { isGlobalRole } = require('../utils/constants');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get approval by Request ID
router.get('/request/:requestId', authenticateToken, async (req, res) => {
    try {
        const approval = await db.maintenanceApproval.findFirst({
            where: { requestId: req.params.requestId, branchId: { not: null } }
        });

        if (!approval) {
            return res.status(404).json({ error: 'Approval not found' });
        }

        // Authorization check
        const isAdmin = isGlobalRole(req.user?.role);
        if (!isAdmin && approval.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        res.json(approval);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch approval' });
    }
});

// Create Approval Request (Center -> Branch)
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { requestId, cost, parts, notes } = req.body;

        const request = await db.maintenanceRequest.findFirst({
            where: { id: requestId, branchId: { not: null } },
            include: { branch: true } // Origin branch
        });

        // Authorization check
        const isAdmin = isGlobalRole(req.user?.role);
        if (!isAdmin && request && request.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        if (!request) return res.status(404).json({ error: 'Request not found' });

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
            await tx.maintenanceRequest.updateMany({
                where: { id: requestId, branchId: request.branchId },
                data: { status: 'WAITING_APPROVAL' }
            });

            return newApproval;
        });

        // Log approval creation (AFTER transaction)
        await logAction({
            entityType: 'MAINTENANCE_APPROVAL',
            entityId: approval.id,
            action: 'CREATE',
            details: `إنشاء طلب موافقة - التكلفة: ${roundMoney(cost)} - الطلب: ${requestId}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: request.branchId
        });

        // Notify Branch (AFTER transaction - notifications can fail without breaking data)
        if (request.branchId) {
            await createNotification({
                branchId: request.branchId,
                type: 'APPROVAL_REQUEST',
                title: 'طلب موافقة على صيانة',
                message: `مطلوب موافقة على تكلفة صيانة للطلب رقم ${requestId} بقيمة ${cost}`,
                data: { requestId, approvalId: approval.id },
                link: `/requests/${requestId}`
            });
        }

        res.json(approval);
    } catch (error) {
        console.error('Create Approval Error:', error);
        res.status(500).json({ error: 'Failed to create approval request' });
    }
});

// Respond to Approval (Branch -> Center)
router.put('/:id/respond', authenticateToken, async (req, res) => {
    try {
        const { status, responseNotes } = req.body; // APPROVED, REJECTED
        const { id } = req.params;
        const responderName = req.user?.displayName || 'Admin';

        // Fetch previous approval to append response notes safely
        // Fetch previous approval - RULE 1
        const previousApproval = await db.maintenanceApproval.findFirst({
            where: { id, branchId: { not: null } }
        });

        if (!previousApproval) {
            return res.status(404).json({ error: 'Approval not found' });
        }

        // Authorization check
        const isAdmin = isGlobalRole(req.user?.role);
        if (!isAdmin && previousApproval.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
        const result = await db.$transaction(async (tx) => {
            // 1. Update approval
            await tx.maintenanceApproval.updateMany({
                where: { id, branchId: previousApproval.branchId },
                data: {
                    status,
                    respondedAt: new Date(),
                    respondedBy: responderName,
                    notes: responseNotes ? `${previousApproval?.notes || ''}\nResponse: ${responseNotes}` : undefined
                }
            });

            const approval = await tx.maintenanceApproval.findFirst({
                where: { id, branchId: previousApproval.branchId }
            });

            // 2. Reload with related request
            const approvalWithRequest = await tx.maintenanceApproval.findFirst({
                where: { id, branchId: previousApproval.branchId },
                include: { request: true }
            });

            // 3. Update Request Status
            await tx.maintenanceRequest.updateMany({
                where: { id: approval.requestId, branchId: previousApproval.branchId },
                data: { status: status === 'APPROVED' ? 'AT_CENTER' : 'CANCELLED' }
            });

            return approvalWithRequest || approval;
        });

        // Log approval response (AFTER transaction)
        await logAction({
            entityType: 'MAINTENANCE_APPROVAL',
            entityId: id,
            action: status === 'APPROVED' ? 'APPROVE' : 'REJECT',
            details: `${status === 'APPROVED' ? 'موافقة' : 'رفض'} على الصيانة - الطلب: ${previousApproval.requestId}${responseNotes ? ' - ' + responseNotes : ''}`,
            userId: req.user?.id,
            performedBy: responderName,
            branchId: previousApproval?.branchId
        });

        // Notify Center (AFTER transaction - notifications can fail without breaking data)
        if (result.request && result.request.servicedByBranchId) {
            await createNotification({
                branchId: result.request.servicedByBranchId,
                type: 'APPROVAL_RESPONSE',
                title: `تم ${status === 'APPROVED' ? 'الموافقة على' : 'رفض'} الصيانة`,
                message: `تم الرد على طلب الموافقة للطلب ${result.requestId}`,
                data: { requestId: result.requestId },
                link: `/requests/${previousApproval.requestId}`
            });
        }

        res.json(result);
    } catch (error) {
        console.error('Respond Approval Error:', error);
        res.status(500).json({ error: 'Failed to respond to approval' });
    }
});

module.exports = router;
