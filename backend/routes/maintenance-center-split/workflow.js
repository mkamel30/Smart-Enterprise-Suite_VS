const express = require('express');
const router = express.Router();
const asyncHandler = require('../../utils/asyncHandler');
const maintenanceCenterService = require('../../services/maintenanceCenterService');
const { success, error } = require('../../utils/apiResponse');

router.post('/machines/:id/assign', asyncHandler(async (req, res) => {
    const { technicianId, technicianName } = req.body;
    if (!technicianId || !technicianName) return error(res, 'technicianId and technicianName are required', 400);
    const result = await maintenanceCenterService.assignTechnician(req.params.id, { technicianId, technicianName }, req.user);
    return success(res, { message: 'Technician assigned successfully', ...result });
}));

router.post('/machines/:id/inspect', asyncHandler(async (req, res) => {
    const { problemDescription, estimatedCost, requiredParts } = req.body;
    if (!problemDescription) return error(res, 'problemDescription is required', 400);
    const result = await maintenanceCenterService.inspectMachine(req.params.id, { problemDescription, estimatedCost, requiredParts }, req.user);
    const message = result.approvalRequest ? 'Inspection completed. Approval request created.' : 'Inspection completed successfully';
    return success(res, { message, ...result });
}));

router.post('/machines/:id/repair', asyncHandler(async (req, res) => {
    const { repairType, parts, cost } = req.body;
    if (!repairType) return error(res, 'repairType is required', 400);
    const result = await maintenanceCenterService.startRepair(req.params.id, { repairType, parts, cost }, req.user);
    const message = result.debtRecord ? 'Repair started. Debt record created.' : 'Repair started successfully';
    return success(res, { message, ...result });
}));

router.post('/machines/:id/request-approval', asyncHandler(async (req, res) => {
    const { cost, parts, notes } = req.body;
    if (!cost || cost <= 0) return error(res, 'Valid cost is required', 400);
    const result = await maintenanceCenterService.requestApproval(req.params.id, { cost, parts, notes }, req.user);
    return success(res, { message: 'Approval request sent to branch successfully', ...result });
}));

router.post('/machines/:id/mark-repaired', asyncHandler(async (req, res) => {
    const { repairNotes, actionTaken } = req.body;
    const result = await maintenanceCenterService.markRepaired(req.params.id, { repairNotes, actionTaken }, req.user);
    return success(res, { message: 'Machine marked as repaired successfully', ...result });
}));

module.exports = router;
