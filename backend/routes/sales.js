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

/**
 * GET Export Sales to Excel
 */
const { exportToExcel } = require('../utils/excel');
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
    const sales = await salesService.getAllSales(req);

    const data = sales.map(s => ({
        'التاريخ': s.saleDate ? new Date(s.saleDate).toLocaleDateString('ar-EG') : '-',
        'العميل': s.customerName || s.customer?.client_name || '-',
        'كود العميل': s.customer?.bkcode || '-',
        'السيريال': s.serialNumber || '-',
        'نوع البيع': s.type === 'CASH' ? 'كاش' : 'تقسيط',
        'إجمالي السعر': s.totalPrice || 0,
        'المدفوع': s.paidAmount || 0,
        'المتبقي': (s.totalPrice || 0) - (s.paidAmount || 0),
        'الحالة': s.status === 'COMPLETED' ? 'مكتمل' : s.status === 'ONGOING' ? 'جاري' : 'معلق'
    }));

    const columns = [
        { header: 'التاريخ', key: 'التاريخ', width: 15 },
        { header: 'العميل', key: 'العميل', width: 25 },
        { header: 'كود العميل', key: 'كود العميل', width: 15 },
        { header: 'السيريال', key: 'السيريال', width: 20 },
        { header: 'نوع البيع', key: 'نوع البيع', width: 12 },
        { header: 'إجمالي السعر', key: 'إجمالي السعر', width: 15 },
        { header: 'المدفوع', key: 'المدفوع', width: 15 },
        { header: 'المتبقي', key: 'المتبقي', width: 15 },
        { header: 'الحالة', key: 'الحالة', width: 12 }
    ];

    const buffer = await exportToExcel(data, columns, 'sales_export');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=sales_export.xlsx');
    res.send(buffer);
}));

module.exports = router;
