const express = require('express');
const router = express.Router();
const db = require('../db');
const { logAction } = require('../utils/logger');
const authenticateToken = require('../middleware/auth');
const { getBranchFilter, requirePermission, PERMISSIONS } = require('../middleware/permissions');

// Import roundMoney from centralized payment service
const { roundMoney } = require('../services/paymentService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

const inventoryService = require('../services/inventoryService');

// GET inventory (parts with quantities PER BRANCH)
router.get('/inventory', authenticateToken, async (req, res) => {
    try {
        const inventory = await inventoryService.getInventory(req);
        res.json(inventory);
    } catch (error) {
        console.error('Inventory error:', error);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
        res.status(500).json({ error: 'Failed to fetch inventory', details: error.message });
    }
});

// POST add stock (IN movement)
router.post('/inventory/stock-in', authenticateToken, async (req, res) => {
    try {
        const result = await inventoryService.stockIn(req, req.body);
        res.json({ success: true, newQuantity: result.newQuantity });
    } catch (error) {
        console.error('Failed to add stock:', error);
        res.status(500).json({ error: 'Failed to add stock' });
    }
});

// POST bulk import stock
router.post('/inventory/import', authenticateToken, async (req, res) => {
    try {
        const { items } = req.body;
        const result = await inventoryService.importStock(req, items, req.body.branchId);
        res.json({ success: true, updated: result.updated });
    } catch (error) {
        console.error('Failed to import stock:', error);
        res.status(500).json({ error: 'Failed to import stock' });
    }
});

// PUT update inventory quantity directly
router.put('/inventory/:partId', authenticateToken, async (req, res) => {
    try {
        const { partId } = req.params;
        const { quantity } = req.body;
        const inventoryItem = await inventoryService.updateQuantity(req, partId, quantity, req.body.branchId);
        res.json({ success: true, quantity: inventoryItem.quantity });
    } catch (error) {
        console.error('Failed to update inventory:', error);
        res.status(500).json({ error: 'Failed to update inventory' });
    }
});

// POST stock out (used in repair)
router.post('/inventory/stock-out', authenticateToken, async (req, res) => {
    try {
        const result = await inventoryService.stockOut(req, req.body, req.body.branchId);
        res.json({ success: true, newQuantity: result.newQuantity, paymentCreated: !!result.payment, paymentId: result.payment?.id });
    } catch (error) {
        console.error('Failed to remove stock:', error);
        res.status(500).json({ error: 'Failed to remove stock' });
    }
});

// POST transfer stock between branches
router.post('/inventory/transfer', authenticateToken, async (req, res) => {
    try {
        const result = await inventoryService.transferStock(req, req.body);
        res.json(result);
    } catch (error) {
        console.error('Transfer failed:', error);
        res.status(400).json({ error: error.message || 'Transfer failed' });
    }
});

// GET stock movements log
router.get('/inventory/movements', authenticateToken, async (req, res) => {
    try {
        const movements = await inventoryService.getMovements(req);
        res.json(movements);
    } catch (error) {
        console.error('Failed to fetch movements:', error);
        res.json([]);
    }
});

module.exports = router;
