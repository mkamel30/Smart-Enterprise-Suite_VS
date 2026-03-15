const express = require('express');
const router = express.Router();
const maintenanceService = require('../../services/maintenanceService');
const { authenticateToken } = require('../../middleware/auth');
const { validateRequest } = require('../../middleware/validation');
const { success, error, paginated } = require('../../utils/apiResponse');
const { ROLES } = require('../../utils/constants');
const asyncHandler = require('../../utils/asyncHandler');
const {
    ApproveSchema,
    RejectSchema,
    GetApprovalRequestsSchema,
} = require('../../validation/schemas/maintenance');

/**
 * GET /
 * Get approval requests (branch-scoped)
 */
router.get(
    '/',
    authenticateToken,
    validateRequest(GetApprovalRequestsSchema),
    asyncHandler(async (req, res) => {
        const result = await maintenanceService.getApprovalRequests(req.query, req.user);
        return success(res, result);
    })
);

/**
 * GET /pending-count
 * Get pending approval requests count
 */
router.get(
    '/pending-count',
    authenticateToken,
    asyncHandler(async (req, res) => {
        const branchId = req.query.branchId || req.user.branchId;
        const result = await maintenanceService.getApprovalRequests({ status: 'PENDING', branchId }, req.user);
        return success(res, { count: result.total });
    })
);

/**
 * PUT /:id/approve
 * Approve maintenance request
 */
router.put(
    '/:id/approve',
    authenticateToken,
    validateRequest(ApproveSchema),
    asyncHandler(async (req, res) => {
        const result = await maintenanceService.respondApproval(req.params.id, { status: 'APPROVED', ...req.body }, req.user);
        return success(res, result);
    })
);

/**
 * PUT /:id/reject
 * Reject maintenance request
 */
router.put(
    '/:id/reject',
    authenticateToken,
    validateRequest(RejectSchema),
    asyncHandler(async (req, res) => {
        const result = await maintenanceService.respondApproval(req.params.id, { status: 'REJECTED', ...req.body }, req.user);
        return success(res, result);
    })
);

module.exports = router;
