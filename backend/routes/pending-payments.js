const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get all pending payments
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, centerBranchId, status } = req.query;

        const where = {};

        // For branches: show what they owe
        if (branchId) {
            where.targetBranchId = branchId;
        }

        // For maintenance centers: show what's owed to them
        if (centerBranchId) {
            where.centerBranchId = centerBranchId;
        }

        // Default to user's branch if nothing specified
        if (!branchId && !centerBranchId && req.user.branchId) {
            // Check if user is in a maintenance center
            const userBranch = await db.branch.findUnique({
                where: { id: req.user.branchId }
            });

            if (userBranch?.type === 'MAINTENANCE_CENTER') {
                where.centerBranchId = req.user.branchId;
            } else {
                where.targetBranchId = req.user.branchId;
            }
        }

        if (status) where.status = status;

        const payments = await db.pendingPayment.findMany(ensureBranchWhere({
            where,
            orderBy: { createdAt: 'desc' }
        }, req));

        res.json(payments);
    } catch (error) {
        console.error('Failed to fetch pending payments:', error);
        res.status(500).json({ error: 'فشل في جلب المستحقات' });
    }
});

// Get summary of pending payments
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { branchId, centerBranchId } = req.query;

        const where = { status: 'PENDING' };

        if (branchId) {
            where.targetBranchId = branchId;
        } else if (centerBranchId) {
            where.centerBranchId = centerBranchId;
        } else if (req.user.branchId) {
            const userBranch = await db.branch.findUnique({
                where: { id: req.user.branchId }
            });

            if (userBranch?.type === 'MAINTENANCE_CENTER') {
                where.centerBranchId = req.user.branchId;
            } else {
                where.targetBranchId = req.user.branchId;
            }
        }

        const payments = await db.pendingPayment.findMany(ensureBranchWhere({
            where
        }, req));

        const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
        const count = payments.length;

        res.json({ totalAmount, count });
    } catch (error) {
        console.error('Failed to fetch payments summary:', error);
        res.status(500).json({ error: 'فشل في جلب ملخص المستحقات' });
    }
});

// Get single pending payment
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const payment = await db.pendingPayment.findUnique({
            where: { id: req.params.id }
        });

        if (!payment) {
            return res.status(404).json({ error: 'المستحق غير موجود' });
        }

        // Authorization: check branch access
        if (req.user.branchId && payment.branchId !== req.user.branchId) {
            const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);
            if (!isAdmin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        res.json(payment);
    } catch (error) {
        console.error('Failed to fetch pending payment:', error);
        res.status(500).json({ error: 'فشل في جلب المستحق' });
    }
});

// Pay pending payment (الفرع يسدد)
router.put('/:id/pay', authenticateToken, async (req, res) => {
    try {
        const { receiptNumber, paymentPlace } = req.body;

        if (!receiptNumber) {
            return res.status(400).json({ error: 'يرجى إدخال رقم الإيصال' });
        }

        const payment = await db.pendingPayment.findUnique({
            where: { id: req.params.id }
        });

        if (!payment) {
            return res.status(404).json({ error: 'المستحق غير موجود' });
        }

        // Authorization: check branch access
        if (req.user.branchId && payment.branchId !== req.user.branchId) {
            const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);
            if (!isAdmin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        if (payment.status !== 'PENDING') {
            return res.status(400).json({ error: 'تم سداد هذا المستحق مسبقاً' });
        }

        // Check if receipt number already exists
        const existingReceipt = await db.payment.findFirst(ensureBranchWhere({
            where: { receiptNumber }
        }, req));

        if (existingReceipt) {
            return res.status(400).json({ error: 'رقم الإيصال مسجل من قبل' });
        }

        const result = await db.$transaction(async (tx) => {
            // Update pending payment
            const updated = await tx.pendingPayment.update({
                where: { id: req.params.id },
                data: {
                    status: 'PAID',
                    receiptNumber,
                    paymentPlace: paymentPlace || 'ضامن',
                    paidAt: new Date(),
                    paidBy: req.user.displayName || req.user.email,
                    paidByUserId: req.user.id
                }
            });

            // Create payment record
            await tx.payment.create({
                data: {
                    customerId: payment.customerId,
                    customerName: payment.customerName,
                    amount: payment.amount,
                    type: 'MAINTENANCE_CENTER',
                    reason: `قطع غيار صيانة مركز - ${payment.machineSerial}`,
                    paymentPlace: paymentPlace || 'ضامن',
                    receiptNumber,
                    userId: req.user.id,
                    userName: req.user.displayName || req.user.email,
                    branchId: req.user.branchId
                }
            });

            // Log the payment
            await tx.systemLog.create({
                data: {
                    entityType: 'PENDING_PAYMENT',
                    entityId: payment.id,
                    action: 'PAID',
                    details: JSON.stringify({
                        amount: payment.amount,
                        receiptNumber,
                        machineSerial: payment.machineSerial
                    }),
                    performedBy: req.user.displayName || req.user.email,
                    userId: req.user.id,
                    branchId: req.user.branchId
                }
            });

            return updated;
        });

        // Notify the maintenance center
        await createNotification({
            branchId: payment.centerBranchId,
            type: 'PAYMENT_RECEIVED',
            title: '💰 تم استلام سداد',
            message: `تم تسجيل سداد ${payment.amount} ج.م للماكينة ${payment.machineSerial} - إيصال: ${receiptNumber}`,
            link: '/pending-payments'
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to pay pending payment:', error);
        res.status(500).json({ error: 'فشل في تسجيل السداد' });
    }
});

module.exports = router;
