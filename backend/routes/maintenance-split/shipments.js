const express = require('express');
const router = express.Router();
const maintenanceService = require('../../services/maintenanceService');
const { authenticateToken } = require('../../middleware/auth');
const { success, error } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');

// GET /shipments - Fetch incoming batches (TransferOrders)
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const result = await maintenanceService.getShipments(req.query, req.user);
    return success(res, result);
}));

// POST /shipments/:id/receive - Confirm Receipt of Batch
router.post('/:id/receive', authenticateToken, asyncHandler(async (req, res) => {
    const result = await maintenanceService.receiveShipment(req.params.id, req.user);
    return success(res, { message: 'Shipment received successfully', order: result });
}));

module.exports = router;
