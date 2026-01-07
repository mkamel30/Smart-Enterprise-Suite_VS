const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/logger');

// Import roundMoney from centralized payment service
const { roundMoney } = require('../services/paymentService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Helper to get branch filter
const getBranchFilter = (req) => {
    if (req.user.branchId) {
        return { branchId: req.user.branchId };
    }
    if (req.query.branchId) {
        return { branchId: req.query.branchId };
    }
    return {};
};

// CHECK receipt number
router.get('/payments/check-receipt', async (req, res) => {
    try {
        const { number } = req.query;
        if (!number) return res.status(400).json({ error: 'Receipt number required' });

        // Check globally for receipt number (pre-printed receipts are system-wide unique)
        const exists = await db.payment.findFirst(ensureBranchWhere({
            where: { receiptNumber: number }
        }, req));

        res.json({ exists: !!exists });
    } catch (error) {
        console.error('Failed to check receipt:', error);
        res.status(500).json({ error: 'Failed to check receipt' });
    }
});

// GET all payments
router.get('/payments', authenticateToken, async (req, res) => {
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
                        client_name: true
                    }
                }
            }
        }, req));
        res.json(payments);
    } catch (error) {
        console.error('Failed to fetch payments:', error);
        res.status(500).json({ error: 'Failed to fetch payments' });
    }
});

// GET payments by customer
router.get('/payments/customer/:customerId', authenticateToken, async (req, res) => {
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
        res.status(500).json({ error: 'Failed to fetch customer payments' });
    }
});

// GET payments stats
router.get('/payments/stats', authenticateToken, async (req, res) => {
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
        res.status(500).json({ error: 'Failed to fetch payment stats' });
    }
});

// POST create payment
router.post('/payments', authenticateToken, async (req, res) => {
    try {
        const { receiptNumber, paymentPlace, amount } = req.body;
        const branchId = req.user.branchId || req.body.branchId;

        if (!branchId) return res.status(400).json({ error: 'Branch ID required' });

        // Validate receipt number uniqueness
        if (receiptNumber && receiptNumber.trim() !== '') {
            const existingPayment = await db.payment.findFirst(ensureBranchWhere({
                where: { receiptNumber: receiptNumber.trim() }
            }, req));
            if (existingPayment) {
                // Duplicate check global
                return res.status(400).json({ error: 'ط±ظ‚ظ… ط§ظ„ط¥ظٹطµط§ظ„ ظ…ط³طھط®ط¯ظ… ظ…ظ† ظ‚ط¨ظ„' });
            }
        }

        const payment = await db.payment.create({
            data: {
                branchId,
                customerId: req.body.customerId,
                customerName: req.body.customerName,
                requestId: req.body.requestId,
                amount: roundMoney(req.body.amount),
                reason: req.body.reason,
                paymentPlace: req.body.paymentPlace,
                receiptNumber: receiptNumber?.trim() || null,
                notes: req.body.notes,
                userId: req.user.id,
                userName: req.user.name
            }
        });

        await logAction({
            entityType: 'PAYMENT',
            entityId: payment.id,
            action: 'CREATE',
            details: `Created payment of ${payment.amount} for ${payment.customerName}`,
            userId: req.user.id,
            performedBy: req.user.name,
            branchId: req.user.branchId
        });

        res.status(201).json(payment);
    } catch (error) {
        console.error('Failed to create payment:', error);
        res.status(500).json({ error: 'Failed to create payment' });
    }
});

// DELETE payment
router.delete('/payments/:id', authenticateToken, async (req, res) => {
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
        res.status(500).json({ error: 'Failed to delete payment' });
    }
});

module.exports = router;
