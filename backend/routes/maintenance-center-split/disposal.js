const express = require('express');
const router = express.Router();
const asyncHandler = require('../../utils/asyncHandler');
const maintenanceCenterService = require('../../services/maintenanceCenterService');
const { success, error } = require('../../utils/apiResponse');

router.post('/machines/:id/total-loss', asyncHandler(async (req, res) => {
    const { reason, notes } = req.body;
    if (!reason) return error(res, 'reason is required', 400);
    const result = await maintenanceCenterService.markTotalLoss(req.params.id, { reason, notes }, req.user);
    return success(res, { message: 'Machine marked as total loss. Return transfer order created.', ...result });
}));

router.post('/machines/:id/return', asyncHandler(async (req, res) => {
    const { notes, driverName, driverPhone } = req.body;
    const result = await maintenanceCenterService.returnToBranch(req.params.id, { notes, driverName, driverPhone }, req.user);
    return success(res, { message: 'Machine scheduled for return to branch', ...result });
}));

router.get('/return/ready', asyncHandler(async (req, res) => {
    const result = await maintenanceCenterService.getMachinesReadyForReturn(req.query, req.user);
    return paginated(res, result.data, result.pagination.total, result.pagination.limit, (result.pagination.page - 1) * result.pagination.limit);
}));

router.post('/return/create', asyncHandler(async (req, res) => {
    const { machineIds, notes, driverName, driverPhone } = req.body;
    if (!machineIds || !Array.isArray(machineIds) || machineIds.length === 0) return error(res, 'يرجى اختيار ماكينة واحدة على الأقل', 400);
    const result = await maintenanceCenterService.createReturnPackage({ machineIds, notes, driverName, driverPhone }, req.user);
    return success(res, { message: result.message, ...result }, 201);
}));

module.exports = router;
