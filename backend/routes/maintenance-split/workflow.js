const express = require('express');
const router = express.Router();
const maintenanceService = require('../../services/maintenanceService');
const { authenticateToken } = require('../../middleware/auth');
const asyncHandler = require('../../utils/asyncHandler');

const { success } = require('../../utils/apiResponse');

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

    return success(res, { machine: result.updatedMachine, approval: result.approval });
}));

module.exports = router;
