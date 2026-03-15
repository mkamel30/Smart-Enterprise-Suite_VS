const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const machineStateService = require('../inventory/machine-state.service.js');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');

// POST /api/machine-workflow/:id/transition
router.post('/:id/transition', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { targetStatus, notes, payload, ...others } = req.body;
    const performedBy = req.user.displayName || req.user.email;

    // Support both nested 'payload' and top-level params
    const finalPayload = payload || others;
    const transitionNotes = notes || finalPayload.notes;

    // Context for the transition
    const context = {
        performedBy,
        notes: transitionNotes,
        branchId: req.user.branchId,
        payload: finalPayload
    };

    const result = await machineStateService.transition(id, targetStatus, context);

    return success(res, {
        message: 'Êã ÊÛííÑ ÍÇáÉ ÇáãÇßíäÉ ÈäÌÇÍ',
        machine: result
    });
}));

// GET /api/machine-workflow/kanban
// Returns machines for the Kanban board (Maintenance Center View)
router.get('/kanban', authenticateToken, asyncHandler(async (req, res) => {
    // Only show machines relevant to the maintenance center:
    // RECEIVED, INSPECTION, APPROVAL, IN_PROGRESS, READY
    const centerStatuses = [
        machineStateService.MachineStatus.RECEIVED_AT_CENTER,
        machineStateService.MachineStatus.ASSIGNED,
        machineStateService.MachineStatus.UNDER_INSPECTION,
        machineStateService.MachineStatus.AWAITING_APPROVAL,
        machineStateService.MachineStatus.IN_PROGRESS,
        machineStateService.MachineStatus.READY_FOR_RETURN
    ];

    const machines = await db.warehouseMachine.findMany({
        where: {
            status: { in: centerStatuses }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return success(res, machines);
}));

module.exports = router;
