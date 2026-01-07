const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const machineStateService = require('../services/machineStateService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// POST /api/machine-workflow/:id/transition
router.post('/:id/transition', authenticateToken, async (req, res) => {
    try {
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

        res.json({
            success: true,
            machine: result
        });
    } catch (error) {
        console.error('Transition failed:', error);
        res.status(400).json({
            error: error.message || 'Transition failed'
        });
    }
});

// GET /api/machine-workflow/kanban
// Returns machines for the Kanban board (Maintenance Center View)
router.get('/kanban', authenticateToken, async (req, res) => {
    try {
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

        const machines = await db.warehouseMachine.findMany(ensureBranchWhere({
            where: {
                status: { in: centerStatuses }
            },
            orderBy: { updatedAt: 'desc' }
        }, req));

        res.json(machines);
    } catch (error) {
        console.error('Failed to fetch Kanban:', error);
        res.status(500).json({ error: 'Failed to fetch board' });
    }
});

module.exports = router;
