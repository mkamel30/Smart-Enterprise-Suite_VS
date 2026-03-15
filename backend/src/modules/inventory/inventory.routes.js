const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { ROLES } = require('../../../utils/constants');
const { authenticateToken } = require('../../../middleware/auth');
const { requirePermission, PERMISSIONS } = require('../../../middleware/permissions');
const asyncHandler = require('../../../utils/asyncHandler');
const { z } = require('zod');
const { roundMoney } = require('../finance/payment.service.js');
const inventoryService = require('./inventory.service.js');

// Validation Schemas
const stockInSchema = z.object({
    partId: z.string(),
    quantity: z.number().int().min(1),
    branchId: z.string().optional()
});
const importStockSchema = z.object({
    items: z.array(z.object({
        partId: z.string(),
        quantity: z.number().int().min(1)
    })),
    branchId: z.string().optional()
});
const updateQuantitySchema = z.object({
    quantity: z.number().int(),
    branchId: z.string().optional()
});
const stockOutSchema = z.object({
    partId: z.string(),
    quantity: z.number().int().min(1),
    branchId: z.string().optional()
});
const transferStockSchema = z.object({
    partId: z.string(),
    quantity: z.number().int().min(1),
    fromBranchId: z.string(),
    toBranchId: z.string()
});

// Pagination helpers removed

// GET inventory lite (dropdowns)
router.get('/inventory/lite', authenticateToken, asyncHandler(async (req, res) => {
    const { search, branchId } = req.query;
    const items = await inventoryService.getInventoryLite(req, { search, branchId });
    return success(res, items);
}));

// GET inventory (parts with quantities PER BRANCH) - PAGINATED
router.get('/inventory', authenticateToken, asyncHandler(async (req, res) => {
    const { page, limit, search, model, branchId } = req.query;

    const limitNum = parseInt(limit) || 50;
    const pageNum = parseInt(page) || 1;
    const offset = (pageNum - 1) * limitNum;

    const { items, total } = await inventoryService.getInventory(req, {
        limit: limitNum,
        offset,
        search,
        model,
        branchId
    });

    return paginated(res, items, total, limitNum, offset);
}));

// POST add stock (IN movement)
router.post('/inventory/stock-in', authenticateToken, asyncHandler(async (req, res) => {
    const validated = stockInSchema.parse(req.body);
    const result = await inventoryService.stockIn(req, validated);
    return success(res, { success: true, newQuantity: result.newQuantity });
}));

// POST bulk import stock
router.post('/inventory/import', authenticateToken, asyncHandler(async (req, res) => {
    const validated = importStockSchema.parse(req.body);
    const result = await inventoryService.importStock(req, validated.items, validated.branchId);
    return success(res, { success: true, updated: result.updated });
}));

// PUT update inventory quantity directly
router.put('/inventory/:partId', authenticateToken, asyncHandler(async (req, res) => {
    const validated = updateQuantitySchema.parse(req.body);
    const { partId } = req.params;
    const inventoryItem = await inventoryService.updateQuantity(req, partId, validated.quantity, validated.branchId);
    return success(res, { success: true, quantity: inventoryItem.quantity });
}));

// POST stock out (used in repair)
router.post('/inventory/stock-out', authenticateToken, asyncHandler(async (req, res) => {
    const validated = stockOutSchema.parse(req.body);
    const result = await inventoryService.stockOut(req, validated, validated.branchId);
    return success(res, { success: true, newQuantity: result.newQuantity, paymentCreated: !!result.payment, paymentId: result.payment?.id });
}));

// POST transfer stock between branches
router.post('/inventory/transfer', authenticateToken, asyncHandler(async (req, res) => {
    const validated = transferStockSchema.parse(req.body);
    const result = await inventoryService.transferStock(req, validated);
    return success(res, result);
}));

// GET stock movements log
router.get('/inventory/movements', authenticateToken, asyncHandler(async (req, res) => {
    const movements = await inventoryService.getMovements(req);
    return success(res, movements);
}));

module.exports = router;
