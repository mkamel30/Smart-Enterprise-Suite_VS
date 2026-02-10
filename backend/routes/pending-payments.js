const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { isGlobalRole } = require('../utils/constants');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get all pending payments
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { branchId, centerBranchId, status } = req.query;

        const where = {};

        // For branches: show what they owe
        if (branchId) {
            where.debtorBranchId = branchId;
        }

        // For maintenance centers: show what's owed to them
        if (centerBranchId) {
            where.creditorBranchId = centerBranchId;
        }

        // Default to user's branch if nothing specified
        if (!branchId && !centerBranchId && req.user.branchId) {
            // Check if user is in a maintenance center
            const userBranch = await db.branch.findUnique({
                where: { id: req.user.branchId }
            });

            if (userBranch?.type === 'MAINTENANCE_CENTER') {
                where.creditorBranchId = req.user.branchId;
            } else {
                where.debtorBranchId = req.user.branchId;
            }
        }

        if (status) where.status = status;

        // Ensure at least one branch field exists to pass enforcer
        // Use _skipBranchEnforcer marker for admin all-branches view
        const isAdmin = isGlobalRole(req.user.role);
        if (!where.debtorBranchId && !where.creditorBranchId) {
            if (isAdmin) {
                where._skipBranchEnforcer = true;
            }
        }

        const payments = await db.branchDebt.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

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
            where.debtorBranchId = branchId;
        } else if (centerBranchId) {
            where.creditorBranchId = centerBranchId;
        } else if (req.user.branchId) {
            const userBranch = await db.branch.findUnique({
                where: { id: req.user.branchId }
            });

            if (userBranch?.type === 'MAINTENANCE_CENTER') {
                where.creditorBranchId = req.user.branchId;
            } else {
                where.debtorBranchId = req.user.branchId;
            }
        }

        // Ensure at least one branch field exists to pass enforcer
        // Use _skipBranchEnforcer marker for admin all-branches view
        const isAdmin = isGlobalRole(req.user.role);
        if (!where.debtorBranchId && !where.creditorBranchId) {
            if (isAdmin) {
                where._skipBranchEnforcer = true;
            }
        }

        const payments = await db.branchDebt.findMany({
            where
        });

        const totalAmount = payments.reduce((sum, p) => sum + p.remainingAmount, 0);
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
        const payment = await db.branchDebt.findFirst({
            where: {
                id: req.params.id,
                OR: [
                    { debtorBranchId: req.user.branchId },
                    { creditorBranchId: req.user.branchId }
                ]
            }
        });

        if (!payment) {
            return res.status(404).json({ error: 'المستحق غير موجود' });
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

        const payment = await db.branchDebt.findFirst({
            where: { id: req.params.id, debtorBranchId: req.user.branchId }
        });

        if (!payment) {
            return res.status(404).json({ error: 'المستحق غير موجود' });
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
            // Update branch debt
            await tx.branchDebt.updateMany({
                where: { id: req.params.id, debtorBranchId: req.user.branchId },
                data: {
                    status: 'PAID',
                    receiptNumber,
                    paymentPlace: paymentPlace || 'ضامن',
                    paidAt: new Date(),
                    paidBy: req.user.displayName || req.user.email,
                    paidByUserId: req.user.id,
                    paidAmount: payment.amount,
                    remainingAmount: 0
                }
            });

            const updated = await tx.branchDebt.findFirst({
                where: { id: req.params.id }
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
                    entityType: 'BRANCH_DEBT',
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
            branchId: payment.creditorBranchId,
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

/**
 * GET Export Pending Payments to Excel
 */
const { exportToExcel } = require('../utils/excel');
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const { branchId, centerBranchId, status } = req.query;
        const where = {};

        if (branchId) where.debtorBranchId = branchId;
        if (centerBranchId) where.creditorBranchId = centerBranchId;
        if (status) where.status = status;

        const isAdmin = isGlobalRole(req.user.role);
        if (!where.debtorBranchId && !where.creditorBranchId && isAdmin) {
            where._skipBranchEnforcer = true;
        }

        const payments = await db.branchDebt.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        const data = payments.map(p => ({
            'التاريخ': new Date(p.createdAt).toLocaleDateString('ar-EG'),
            'السيريال': p.machineSerial || '-',
            'العميل': p.customerName || '-',
            'المبلغ': p.amount || 0,
            'المتبقي': p.remainingAmount || 0,
            'الحالة': p.status === 'PENDING' ? 'معلق' : p.status === 'PAID' ? 'مدفوع' : p.status,
            'رقم الإيصال': p.receiptNumber || '-',
            'تاريخ السداد': p.paidAt ? new Date(p.paidAt).toLocaleDateString('ar-EG') : '-'
        }));

        const columns = [
            { header: 'التاريخ', key: 'التاريخ', width: 15 },
            { header: 'السيريال', key: 'السيريال', width: 20 },
            { header: 'العميل', key: 'العميل', width: 25 },
            { header: 'المبلغ', key: 'المبلغ', width: 12 },
            { header: 'المتبقي', key: 'المتبقي', width: 12 },
            { header: 'الحالة', key: 'الحالة', width: 12 },
            { header: 'رقم الإيصال', key: 'رقم الإيصال', width: 15 },
            { header: 'تاريخ السداد', key: 'تاريخ السداد', width: 15 }
        ];

        const buffer = await exportToExcel(data, columns, 'pending_payments_export');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=pending_payments_export.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Failed to export pending payments:', error);
        res.status(500).json({ error: 'فشل في تصدير المستحقات' });
    }
});

module.exports = router;
