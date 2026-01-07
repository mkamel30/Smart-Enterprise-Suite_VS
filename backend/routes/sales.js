const express = require('express');
const router = express.Router();
const { z } = require('zod');
const salesService = require('../services/salesService');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const asyncHandler = require('../utils/asyncHandler');

// Validation Schemas
const createSaleSchema = z.object({
    customerId: z.string().min(1),
    machineId: z.string().optional(),
    simCardId: z.string().optional(),
    items: z.array(z.object({
        partId: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative()
    })).optional(),
    paymentType: z.enum(['CASH', 'INSTALLMENT', 'PARTIAL']),
    amountPaid: z.number().nonnegative(),
    notes: z.string().optional()
});

const payInstallmentSchema = z.object({
    amount: z.number().positive(),
    notes: z.string().optional(),
    receiptNumber: z.string().optional()
});

const recalculateSchema = z.object({
    newAmount: z.number().positive().optional(),
    months: z.number().int().positive().optional()
});

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
router.post('/', authenticateToken, validateRequest(createSaleSchema), asyncHandler(async (req, res) => {
    const result = await salesService.createSale(req.body, req.user, req);
    res.json(result);
}));

/**
 * POST Pay Installment
 */
router.post('/installments/:id/pay', authenticateToken, validateRequest(payInstallmentSchema), asyncHandler(async (req, res) => {
    const result = await salesService.payInstallment(req.params.id, req.body, req.user, req);
    res.json(result);
}));

/**
 * PUT Recalculate Installments
 */
router.put('/:saleId/recalculate', authenticateToken, validateRequest(recalculateSchema), asyncHandler(async (req, res) => {
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
