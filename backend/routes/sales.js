const express = require('express');
const router = express.Router();
const salesService = require('../services/salesService');
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

/**
 * GET All Sales
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const sales = await salesService.getAllSales(req);
    res.json(sales);
}));

/**
 * GET Installments (due or all)
 */
router.get('/installments', authenticateToken, asyncHandler(async (req, res) => {
    const installments = await salesService.getInstallments(req, req.query);
    res.json(installments);
}));

/**
 * POST Create Sale
 */
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    const result = await salesService.createSale(req.body, req.user, req);
    res.json(result);
}));

/**
 * POST Pay Installment
 */
router.post('/installments/:id/pay', authenticateToken, asyncHandler(async (req, res) => {
    const result = await salesService.payInstallment(req.params.id, req.body, req.user, req);
    res.json(result);
}));

/**
 * PUT Recalculate Installments
 */
router.put('/:saleId/recalculate', authenticateToken, asyncHandler(async (req, res) => {
    const newInstallments = await salesService.recalculateInstallments(req.params.saleId, req.body, req.user);
    res.json({ success: true, newInstallments });
}));

/**
 * DELETE Sale (Void Transaction)
 */
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const result = await salesService.deleteSale(req.params.id, req.user);
    res.json(result);
}));

module.exports = router;
