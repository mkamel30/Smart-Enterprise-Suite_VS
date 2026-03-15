const express = require('express');
const router = express.Router();
const { z } = require('zod');
const salesService = require('./sales.service.js');
const { authenticateToken } = require('../../../middleware/auth');
const { validateRequest } = require('../../../middleware/validation');
const asyncHandler = require('../../../utils/asyncHandler');

// Validation Schemas
const createSaleSchema = z.object({
    customerId: z.string().min(1),
    serialNumber: z.string().min(1),
    type: z.enum(['CASH', 'INSTALLMENT']),
    totalPrice: z.number().nonnegative(),
    paidAmount: z.number().nonnegative(),
    installmentCount: z.number().int().nonnegative().optional(),
    notes: z.string().optional(),
    paymentMethod: z.string().optional(),
    paymentPlace: z.string().optional(),
    receiptNumber: z.string().optional(),
    branchId: z.string().optional(),
    performedBy: z.string().optional()
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
 * GET Dashboard Stats
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
    const stats = await salesService.getDashboardStats(req);
    res.json(stats);
}));

const { parsePaginationParams, createPaginationResponse } = require('../../../utils/pagination');

/**
 * GET All Sales - PAGINATED
 */
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { limit, offset } = parsePaginationParams(req.query);
    const { items, total } = await salesService.getAllSales(req, { limit, offset });
    res.json(createPaginationResponse(items, total, limit, offset));
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

/**
 * GET Export Sales to Excel
 */
const { exportToExcel } = require('../../../utils/excel');
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
    const { items: sales } = await salesService.getAllSales(req);

    const data = sales.map(s => ({
        'ÇáÊÇÑíÎ': s.saleDate ? new Date(s.saleDate).toLocaleDateString('ar-EG') : '-',
        'ÇáÚãíá': s.customerName || s.customer?.client_name || '-',
        'ßæÏ ÇáÚãíá': s.customer?.bkcode || '-',
        'ÇáÓíÑíÇá': s.serialNumber || '-',
        'äæÚ ÇáÈíÚ': s.type === 'CASH' ? 'ßÇÔ' : 'ÊÞÓíØ',
        'ÅÌãÇáí ÇáÓÚÑ': s.totalPrice || 0,
        'ÇáãÏÝæÚ': s.paidAmount || 0,
        'ÇáãÊÈÞí': (s.totalPrice || 0) - (s.paidAmount || 0),
        'ÇáÍÇáÉ': s.status === 'COMPLETED' ? 'ãßÊãá' : s.status === 'ONGOING' ? 'ÌÇÑí' : 'ãÚáÞ'
    }));

    const columns = [
        { header: 'ÇáÊÇÑíÎ', key: 'ÇáÊÇÑíÎ', width: 15 },
        { header: 'ÇáÚãíá', key: 'ÇáÚãíá', width: 25 },
        { header: 'ßæÏ ÇáÚãíá', key: 'ßæÏ ÇáÚãíá', width: 15 },
        { header: 'ÇáÓíÑíÇá', key: 'ÇáÓíÑíÇá', width: 20 },
        { header: 'äæÚ ÇáÈíÚ', key: 'äæÚ ÇáÈíÚ', width: 12 },
        { header: 'ÅÌãÇáí ÇáÓÚÑ', key: 'ÅÌãÇáí ÇáÓÚÑ', width: 15 },
        { header: 'ÇáãÏÝæÚ', key: 'ÇáãÏÝæÚ', width: 15 },
        { header: 'ÇáãÊÈÞí', key: 'ÇáãÊÈÞí', width: 15 },
        { header: 'ÇáÍÇáÉ', key: 'ÇáÍÇáÉ', width: 12 }
    ];

    const buffer = await exportToExcel(data, columns, 'sales_export');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_export.xlsx');
    res.send(buffer);
}));

module.exports = router;
