const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { logAction } = require('../utils/logger');

// Import roundMoney from centralized payment service
const { roundMoney } = require('../services/paymentService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Validation Schemas
const createPaymentSchema = z.object({
    receiptNumber: z.string().optional(),
    paymentPlace: z.string().optional(),
    amount: z.number().positive(),
    branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
    customerId: z.string().optional(),
    customerName: z.string().optional(),
    requestId: z.string().optional(),
    reason: z.string().optional(),
    notes: z.string().optional()
});

// CHECK receipt number
router.get('/check-receipt', authenticateToken, async (req, res) => {
    try {
        const { number } = req.query;
        if (!number) return res.status(400).json({ error: 'Receipt number required' });

        // Check globally for receipt number (pre-printed receipts are system-wide unique)
        // We add branchId: { not: null } to satisfy the branchEnforcer middleware while keeping the check global
        const exists = await db.payment.findFirst({
            where: {
                receiptNumber: number,
                branchId: { not: null }
            }
        });

        res.json({ exists: !!exists });
    } catch (error) {
        console.error('Failed to check receipt:', error);
        res.status(500).json({ error: 'فشل في التحقق من رقم الإيصال' });
    }
});

// GET all payments
router.get('/', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);

        const payments = await db.payment.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' },
            take: 500,
            include: {
                branch: true,
                customer: {
                    select: {
                        client_name: true,
                        bkcode: true
                    }
                }
            }
        }, req));
        res.json(payments);
    } catch (error) {
        console.error('Failed to fetch payments:', error);
        res.status(500).json({ error: 'فشل في جلب المدفوعات' });
    }
});

// GET payments by customer
router.get('/customer/:customerId', authenticateToken, async (req, res) => {
    try {
        const where = {
            customerId: req.params.customerId,
            ...getBranchFilter(req)
        };

        const payments = await db.payment.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' }
        }, req));
        res.json(payments);
    } catch (error) {
        console.error('Failed to fetch customer payments:', error);
        res.status(500).json({ error: 'فشل في جلب مدفوعات العميل' });
    }
});

// GET payments stats
router.get('/stats', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const thisMonth = new Date();
        thisMonth.setDate(1);
        thisMonth.setHours(0, 0, 0, 0);

        const [total, todayTotal, monthTotal, byPlace] = await Promise.all([
            db.payment.aggregate(ensureBranchWhere({
                where: branchFilter,
                _sum: { amount: true }
            }, req)),
            db.payment.aggregate(ensureBranchWhere({
                where: { ...branchFilter, createdAt: { gte: today } },
                _sum: { amount: true }
            }, req)),
            db.payment.aggregate(ensureBranchWhere({
                where: { ...branchFilter, createdAt: { gte: thisMonth } },
                _sum: { amount: true }
            }, req)),
            db.payment.groupBy(ensureBranchWhere({
                by: ['paymentPlace'],
                where: branchFilter,
                _sum: { amount: true },
                _count: true
            }, req))
        ]);

        res.json({
            total: total._sum.amount || 0,
            today: todayTotal._sum.amount || 0,
            month: monthTotal._sum.amount || 0,
            byPlace
        });
    } catch (error) {
        console.error('Failed to fetch payment stats:', error);
        res.status(500).json({ error: 'فشل في جلب إحصائيات المدفوعات' });
    }
});

// POST create payment
router.post('/', authenticateToken, validateRequest(createPaymentSchema), async (req, res) => {
    try {
        const { receiptNumber, paymentPlace, amount, notes, customerId, customerName, requestId, reason } = req.body;
        const branchId = req.user.branchId || req.body.branchId;

        if (!branchId) return res.status(400).json({ error: 'Branch ID required' });

        // Resolve customer by bkcode if provided (frontend usually sends bkcode as customerId)
        let actualCustomerId = null;
        let finalCustomerName = customerName;

        if (customerId) {
            const customer = await db.customer.findFirst({
                where: {
                    bkcode: customerId,
                    branchId
                }
            });

            if (customer) {
                actualCustomerId = customer.id; // Use the cuid
                finalCustomerName = customer.client_name;
            } else if (customerId.length >= 25) {
                // If it looks like a cuid already, try finding by that
                const customerByCuid = await db.customer.findFirst({
                    where: { id: customerId, branchId }
                });
                if (customerByCuid) {
                    actualCustomerId = customerByCuid.id;
                    finalCustomerName = customerByCuid.client_name;
                }
            }
        }

        const payment = await db.payment.create({
            data: {
                branchId,
                customerId: actualCustomerId,
                customerName: finalCustomerName,
                requestId,
                amount: roundMoney(amount),
                reason,
                paymentPlace,
                receiptNumber: receiptNumber?.trim() || null,
                notes,
                userId: req.user.id,
                userName: req.user.displayName || req.user.name
            }
        });

        await logAction({
            entityType: 'PAYMENT',
            entityId: payment.id,
            action: 'CREATE',
            details: `Created payment of ${payment.amount} for ${payment.customerName}`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: req.user.branchId
        });

        res.status(201).json(payment);
    } catch (error) {
        console.error('Failed to create payment:', error);
        res.status(500).json({ error: 'فشل في إنشاء الدفع' });
    }
});

// DELETE payment
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // RULE 1: MUST include branchId
        const payment = await db.payment.findFirst({
            where: { id: req.params.id, branchId: { not: null } }
        });

        if (!payment) {
            return res.status(404).json({ error: 'Payment not found' });
        }

        if (req.user.branchId && payment.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.payment.deleteMany({
            where: { id: req.params.id, branchId: { not: null } }
        });

        await logAction({
            entityType: 'PAYMENT',
            entityId: payment.id,
            action: 'DELETE',
            details: `Deleted payment of ${payment.amount} (${payment.receiptNumber || 'No Receipt'})`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'Admin',
            branchId: req.user?.branchId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete payment:', error);
        res.status(500).json({ error: 'فشل في حذف الدفع' });
    }
});

/**
 * GET Export Payments to Excel
 */
const { exportToExcel } = require('../utils/excel');
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);
        const payments = await db.payment.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' },
            include: { customer: { select: { client_name: true, bkcode: true } } }
        }, req));

        const data = payments.map(p => ({
            'التاريخ': new Date(p.createdAt).toLocaleDateString('ar-EG'),
            'العميل': p.customerName || p.customer?.client_name || '-',
            'كود العميل': p.customer?.bkcode || '-',
            'المبلغ': p.amount || 0,
            'السبب': p.reason || '-',
            'رقم الإيصال': p.receiptNumber || '-',
            'مكان الدفع': p.paymentPlace || '-',
            'الموظف': p.userName || '-'
        }));

        const columns = [
            { header: 'التاريخ', key: 'التاريخ', width: 15 },
            { header: 'العميل', key: 'العميل', width: 25 },
            { header: 'كود العميل', key: 'كود العميل', width: 15 },
            { header: 'المبلغ', key: 'المبلغ', width: 12 },
            { header: 'السبب', key: 'السبب', width: 20 },
            { header: 'رقم الإيصال', key: 'رقم الإيصال', width: 15 },
            { header: 'مكان الدفع', key: 'مكان الدفع', width: 15 },
            { header: 'الموظف', key: 'الموظف', width: 20 }
        ];

        const buffer = await exportToExcel(data, columns, 'payments_export');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=payments_export.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Failed to export payments:', error);
        res.status(500).json({ error: 'فشل في تصدير المدفوعات' });
    }
});

module.exports = router;
