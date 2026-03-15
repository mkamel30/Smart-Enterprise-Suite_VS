const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { createNotification } = require('../system/notifications.routes.js');
const { ensureBranchWhere } = require('../../../prisma/branchHelpers');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { DEBT_STATUS, BRANCH_TYPES, isGlobalRole } = require('../../../utils/constants');
const { parsePaginationParams } = require('../../../utils/pagination');

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

            if (userBranch?.type === BRANCH_TYPES.MAINTENANCE_CENTER) {
                where.creditorBranchId = req.user.branchId;
            } else {
                where.debtorBranchId = req.user.branchId;
            }
        }

        if (status) {
            where.status = status;
        } else {
            where.status = DEBT_STATUS.PENDING;
        }

        // Ensure at least one branch field exists to pass enforcer
        const isAdmin = isGlobalRole(req.user.role);
        if (!where.debtorBranchId && !where.creditorBranchId) {
            if (isAdmin) {
                where.debtorBranchId = { not: 'BYPASS' };
            }
        }

        const { limit, offset } = parsePaginationParams(req.query);
        const [payments, total] = await Promise.all([
            db.branchDebt.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            db.branchDebt.count({ where })
        ]);

        return paginated(res, payments, total, limit, offset);
    } catch (err) {
        console.error('Failed to fetch pending payments:', err);
        return error(res, 'ÝÔá Ýí ÌáÈ ÇáãÓÊÍÞÇÊ');
    }
});

// Get summary of pending payments
router.get('/summary', authenticateToken, async (req, res) => {
    try {
        const { branchId, centerBranchId } = req.query;

        const where = { status: DEBT_STATUS.PENDING };

        if (branchId) {
            where.debtorBranchId = branchId;
        } else if (centerBranchId) {
            where.creditorBranchId = centerBranchId;
        } else if (req.user.branchId) {
            const userBranch = await db.branch.findUnique({
                where: { id: req.user.branchId }
            });

            if (userBranch?.type === BRANCH_TYPES.MAINTENANCE_CENTER) {
                where.creditorBranchId = req.user.branchId;
            } else {
                where.debtorBranchId = req.user.branchId;
            }
        }

        // Ensure at least one branch field exists to pass enforcer
        const isAdmin = isGlobalRole(req.user.role);
        if (!where.debtorBranchId && !where.creditorBranchId) {
            if (isAdmin) {
                where.debtorBranchId = { not: 'BYPASS' };
            }
        }

        const payments = await db.branchDebt.findMany({
            where,
            select: { remainingAmount: true }
        });

        const totalAmount = payments.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);
        const count = payments.length;

        return success(res, { totalAmount, count });
    } catch (err) {
        console.error('Failed to fetch payments summary:', err);
        return error(res, 'ÝÔá Ýí ÌáÈ ãáÎÕ ÇáãÓÊÍÞÇÊ');
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
            return error(res, 'ÇáãÓÊÍÞ ÛíÑ ãæÌæÏ', 404);
        }

        return success(res, payment);
    } catch (err) {
        console.error('Failed to fetch pending payment:', err);
        return error(res, 'ÝÔá Ýí ÌáÈ ÇáãÓÊÍÞ');
    }
});

// Pay pending payment (ÇáÝÑÚ íÓÏÏ)
router.put('/:id/pay', authenticateToken, async (req, res) => {
    try {
        const { receiptNumber, paymentPlace } = req.body;

        if (!receiptNumber) {
            return error(res, 'íÑÌì ÅÏÎÇá ÑÞã ÇáÅíÕÇá', 400);
        }

        const payment = await db.branchDebt.findFirst({
            where: { id: req.params.id, debtorBranchId: req.user.branchId }
        });

        if (!payment) {
            return error(res, 'ÇáãÓÊÍÞ ÛíÑ ãæÌæÏ', 404);
        }

        if (payment.status !== DEBT_STATUS.PENDING) {
            return error(res, 'Êã ÓÏÇÏ åÐÇ ÇáãÓÊÍÞ ãÓÈÞÇð', 400);
        }

        // Check if receipt number already exists
        const existingReceipt = await db.payment.findFirst(ensureBranchWhere({
            where: { receiptNumber }
        }, req));

        if (existingReceipt) {
            return error(res, 'ÑÞã ÇáÅíÕÇá ãÓÌá ãä ÞÈá', 400);
        }

        const result = await db.$transaction(async (tx) => {
            // Update branch debt
            await tx.branchDebt.updateMany({
                where: { id: req.params.id, debtorBranchId: req.user.branchId },
                data: {
                    status: DEBT_STATUS.PAID,
                    receiptNumber,
                    paymentPlace: paymentPlace || 'ÖÇãä',
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
                    reason: `ÞØÚ ÛíÇÑ ÕíÇäÉ ãÑßÒ - ${payment.machineSerial}`,
                    paymentPlace: paymentPlace || 'ÖÇãä',
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
            title: '?? Êã ÇÓÊáÇã ÓÏÇÏ',
            message: `Êã ÊÓÌíá ÓÏÇÏ ${payment.amount} Ì.ã ááãÇßíäÉ ${payment.machineSerial} - ÅíÕÇá: ${receiptNumber}`,
            link: '/pending-payments'
        });

        return success(res, result);
    } catch (err) {
        console.error('Failed to pay pending payment:', err);
        return error(res, 'ÝÔá Ýí ÊÓÌíá ÇáÓÏÇÏ');
    }
});

/**
 * GET Export Pending Payments to Excel
 */
const { exportToExcel } = require('../../../utils/excel');
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const { branchId, centerBranchId, status } = req.query;
        const where = {};

        if (branchId) where.debtorBranchId = branchId;
        if (centerBranchId) where.creditorBranchId = centerBranchId;
        if (status) where.status = status;

        const isAdmin = isGlobalRole(req.user.role);
        if (!where.debtorBranchId && !where.creditorBranchId && isAdmin) {
            where.debtorBranchId = { not: 'BYPASS' };
        }

        const payments = await db.branchDebt.findMany({
            where,
            orderBy: { createdAt: 'desc' }
        });

        const data = payments.map(p => ({
            'ÇáÊÇÑíÎ': new Date(p.createdAt).toLocaleDateString('ar-EG'),
            'ÇáÓíÑíÇá': p.machineSerial || '-',
            'ÇáÚãíá': p.customerName || '-',
            'ÇáãÈáÛ': p.amount || 0,
            'ÇáãÊÈÞí': p.remainingAmount || 0,
            'ÇáÍÇáÉ': p.status === 'PENDING' ? 'ãÚáÞ' : p.status === 'PAID' ? 'ãÏÝæÚ' : p.status,
            'ÑÞã ÇáÅíÕÇá': p.receiptNumber || '-',
            'ÊÇÑíÎ ÇáÓÏÇÏ': p.paidAt ? new Date(p.paidAt).toLocaleDateString('ar-EG') : '-'
        }));

        const columns = [
            { header: 'ÇáÊÇÑíÎ', key: 'ÇáÊÇÑíÎ', width: 15 },
            { header: 'ÇáÓíÑíÇá', key: 'ÇáÓíÑíÇá', width: 20 },
            { header: 'ÇáÚãíá', key: 'ÇáÚãíá', width: 25 },
            { header: 'ÇáãÈáÛ', key: 'ÇáãÈáÛ', width: 12 },
            { header: 'ÇáãÊÈÞí', key: 'ÇáãÊÈÞí', width: 12 },
            { header: 'ÇáÍÇáÉ', key: 'ÇáÍÇáÉ', width: 12 },
            { header: 'ÑÞã ÇáÅíÕÇá', key: 'ÑÞã ÇáÅíÕÇá', width: 15 },
            { header: 'ÊÇÑíÎ ÇáÓÏÇÏ', key: 'ÊÇÑíÎ ÇáÓÏÇÏ', width: 15 }
        ];

        const buffer = await exportToExcel(data, columns, 'pending_payments_export');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=pending_payments_export.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Failed to export pending payments:', error);
        res.status(500).json({ error: 'ÝÔá Ýí ÊÕÏíÑ ÇáãÓÊÍÞÇÊ' });
    }
});

module.exports = router;
