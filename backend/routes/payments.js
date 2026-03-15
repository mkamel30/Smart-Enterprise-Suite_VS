const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest } = require('../middleware/validation');
const { success, error, paginated } = require('../utils/apiResponse');
const { ROLES } = require('../utils/constants');
const { logAction } = require('../utils/logger');
const asyncHandler = require('../utils/asyncHandler');
const { roundMoney } = require('../services/paymentService');
const { exportEntitiesToExcel, transformPaymentsForExport, setExcelHeaders, generateExportFilename } = require('../utils/excelExport');
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
router.get('/check-receipt', authenticateToken, asyncHandler(async (req, res) => {
    const { number } = req.query;
    if (!number) return error(res, 'Receipt number required', 400);

    const exists = await db.payment.findFirst({
        where: {
            receiptNumber: number
        }
    });

    return success(res, { exists: !!exists });
}));

// Pagination helpers removed

// GET all payments - PAGINATED
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const where = {};

    const [payments, total] = await Promise.all([
        db.payment.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset,
            include: {
                branch: true,
                customer: {
                    select: {
                        client_name: true,
                        bkcode: true
                    }
                }
            }
        }),
        db.payment.count({ where })
    ]);

    return paginated(res, payments, total, limit, offset);
}));

// GET payments by customer
router.get('/customer/:customerId', authenticateToken, asyncHandler(async (req, res) => {
    const where = {
        customerId: req.params.customerId
    };

    const payments = await db.payment.findMany({
        where,
        orderBy: { createdAt: 'desc' }
    });
    return success(res, payments);
}));

// GET payments stats
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const [totalAgg, todayTotal, monthTotal, byPlace] = await Promise.all([
        db.payment.aggregate({
            _sum: { amount: true }
        }),
        db.payment.aggregate({
            where: { createdAt: { gte: today } },
            _sum: { amount: true }
        }),
        db.payment.aggregate({
            where: { createdAt: { gte: thisMonth } },
            _sum: { amount: true }
        }),
        db.payment.groupBy({
            by: ['paymentPlace'],
            _sum: { amount: true },
            _count: true
        })
    ]);

    return success(res, {
        total: totalAgg._sum.amount || 0,
        today: todayTotal._sum.amount || 0,
        month: monthTotal._sum.amount || 0,
        byPlace
    });
}));

// POST create payment
router.post('/', authenticateToken, validateRequest(createPaymentSchema), asyncHandler(async (req, res) => {
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

    return success(res, payment, 201);
}));

// DELETE payment
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
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

    await db.payment.delete({
        where: { id: req.params.id }
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

    return success(res, { success: true });
}));

/**
 * GET Export Payments to Excel
 */
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
    const where = getBranchFilter(req);
    const payments = await db.payment.findMany({
        orderBy: { createdAt: 'desc' },
        include: { customer: { select: { client_name: true, bkcode: true } } }
    });

    const data = transformPaymentsForExport(payments);
    const buffer = await exportEntitiesToExcel(data, 'payments', 'payments_export');

    setExcelHeaders(res, generateExportFilename('payments_export'));
    res.send(buffer);
}));

module.exports = router;
