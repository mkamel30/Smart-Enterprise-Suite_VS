const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const machineTrackingService = require('../services/machineTrackingService');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET /api/track-machines
 * Get machines status for branch (track machines sent to maintenance center)
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const result = await machineTrackingService.getTrackedMachines(req.query, req.user);
    return success(res, result);
}));

/**
 * GET /api/track-machines/summary
 * Get summary of machines at maintenance center
 */
router.get('/summary', authenticateToken, asyncHandler(async (req, res) => {
    const result = await machineTrackingService.getTrackingSummary(req.query, req.user);
    return success(res, result);
}));

/**
 * GET /api/track-machines/:serialNumber
 * Get single machine tracking info
 */
router.get('/:serialNumber', authenticateToken, asyncHandler(async (req, res) => {
    const result = await machineTrackingService.getMachineTrackingInfo(req.params.serialNumber, req.user);
    if (!result) {
        return error(res, 'الماكينة غير موجودة في المركز', 404);
    }
    return success(res, result);
}));

module.exports = router;
