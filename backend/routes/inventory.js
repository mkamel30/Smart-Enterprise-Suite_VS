const express = require('express');
const router = express.Router();
const db = require('../db');
const { logAction } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter, requirePermission, PERMISSIONS } = require('../middleware/permissions');
const asyncHandler = require('../utils/asyncHandler');
const { z } = require('zod');
const { roundMoney } = require('../services/paymentService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const inventoryService = require('../services/inventoryService');

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

// GET inventory (parts with quantities PER BRANCH)
router.get('/inventory', authenticateToken, asyncHandler(async (req, res) => {
    const inventory = await inventoryService.getInventory(req);
    res.json(inventory);
}));

// POST add stock (IN movement)
router.post('/inventory/stock-in', authenticateToken, asyncHandler(async (req, res) => {
    const validated = stockInSchema.parse(req.body);
    const result = await inventoryService.stockIn(req, validated);
    res.json({ success: true, newQuantity: result.newQuantity });
}));

// POST bulk import stock
router.post('/inventory/import', authenticateToken, asyncHandler(async (req, res) => {
    const validated = importStockSchema.parse(req.body);
    const result = await inventoryService.importStock(req, validated.items, validated.branchId);
    res.json({ success: true, updated: result.updated });
}));

// PUT update inventory quantity directly
router.put('/inventory/:partId', authenticateToken, asyncHandler(async (req, res) => {
    const validated = updateQuantitySchema.parse(req.body);
    const { partId } = req.params;
    const inventoryItem = await inventoryService.updateQuantity(req, partId, validated.quantity, validated.branchId);
    res.json({ success: true, quantity: inventoryItem.quantity });
}));

// POST stock out (used in repair)
router.post('/inventory/stock-out', authenticateToken, asyncHandler(async (req, res) => {
    const validated = stockOutSchema.parse(req.body);
    const result = await inventoryService.stockOut(req, validated, validated.branchId);
    res.json({ success: true, newQuantity: result.newQuantity, paymentCreated: !!result.payment, paymentId: result.payment?.id });
}));

// POST transfer stock between branches
router.post('/inventory/transfer', authenticateToken, asyncHandler(async (req, res) => {
    const validated = transferStockSchema.parse(req.body);
    const result = await inventoryService.transferStock(req, validated);
    res.json(result);
}));

// GET stock movements log
router.get('/inventory/movements', authenticateToken, asyncHandler(async (req, res) => {
    const movements = await inventoryService.getMovements(req);
    res.json(movements);
}));

module.exports = router;
