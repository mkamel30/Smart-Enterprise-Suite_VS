const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken, authorize } = require('../../../middleware/auth');
const { asyncHandler } = require('../../../utils/errorHandler');
const { ROLES } = require('../../../utils/constants');

// Constants for allowed roles (Accountant + Admins)
const FINANCE_ROLES = [
    ROLES.ACCOUNTANT,
    ROLES.SUPER_ADMIN,
    ROLES.MANAGEMENT,
    ROLES.ADMIN_AFFAIRS,
    ROLES.BRANCH_MANAGER
];

// --- Helper Functions ---

/**
 * Identify transaction type based on source
 */
const getTransactionType = (source) => {
    if (source === 'MachineSale') return 'مبيعات ماكينات';
    if (source === 'Payment') return 'مدفوعات صيانة/أخرى';
    if (source === 'StockMovement') return 'قطع غيار (مدفوع)';
    if (source === 'SimCard') return 'مبيعات شرائح';
    return 'عام';
};

// --- Endpoints ---

/**
 * GET /dashboard-stats
 * Aggregates financial KPIs for a given period
 */
router.get('/dashboard-stats', authenticateToken, authorize(FINANCE_ROLES), asyncHandler(async (req, res) => {
    const { startDate, endDate, branchId } = req.query;

    const today = new Date();
    const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    dateStart.setHours(0, 0, 0, 0);
    dateEnd.setHours(23, 59, 59, 999);

    const branchFilter = branchId ? { branchId } : {};

    // 1. Fetch ALL payments in the period for accurate cash-in analysis
    const allPayments = await db.payment.findMany({
        where: {
            createdAt: { gte: dateStart, lte: dateEnd },
            ...branchFilter
        }
    });

    let machineSalesRevenue = 0;
    let maintenanceRevenue = 0;

    allPayments.forEach(p => {
        const type = p.type || '';
        const reason = p.reason || '';
        const isMachine = type === 'SALE' || type === 'INSTALLMENT' || reason.includes('قسط') || reason.includes('بيع') || reason.includes('ماكينة');

        if (isMachine) {
            machineSalesRevenue += p.amount;
        } else {
            maintenanceRevenue += p.amount;
        }
    });

    // 2. Total Income (Actual Cash Receipts)
    const totalIncome = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // 3. Current Total Pending Debt (Installments not yet paid)
    const pendingInstallmentsAgg = await db.installment.aggregate({
        where: {
            isPaid: false,
            ...branchFilter
        },
        _sum: { amount: true }
    });
    const pendingInstallments = pendingInstallmentsAgg._sum.amount || 0;

    // 4. Value of Parts Used (for statistics)
    const paidMovements = await db.stockMovement.findMany({
        where: {
            createdAt: { gte: dateStart, lte: dateEnd },
            ...branchFilter,
            type: 'OUT',
            isPaid: true
        }
    });

    const partIds = [...new Set(paidMovements.map(m => m.partId))];
    const parts = await db.sparePart.findMany({ where: { id: { in: partIds } } });
    const partsMap = Object.fromEntries(parts.map(p => [p.id, p]));

    const partsRevenue = paidMovements.reduce((sum, move) => {
        const part = partsMap[move.partId];
        return sum + (Math.abs(move.quantity) * (part?.defaultCost || 0));
    }, 0);

    res.json({
        totalIncome,
        machineSalesRevenue,
        pendingInstallments,
        partsRevenue,
        maintenanceRevenue
    });
}));

/**
 * GET /transactions
 * Fetches adequate list of all financial transactions
 */
router.get('/transactions', authenticateToken, authorize(FINANCE_ROLES), asyncHandler(async (req, res) => {
    const { startDate, endDate, branchId, limit = 100 } = req.query;
    const today = new Date();
    const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0);

    dateStart.setHours(0, 0, 0, 0);
    dateEnd.setHours(23, 59, 59, 999);

    const whereBranch = branchId ? { branchId } : {};

    // Fetch transactions from different sources concurrently
    const [payments, freeParts] = await Promise.all([
        // 1. All Payments (Source of truth for cash flow)
        db.payment.findMany({
            where: {
                createdAt: { gte: dateStart, lte: dateEnd },
                ...whereBranch
            },
            include: {
                branch: true,
                customer: true,
                request: {
                    include: {
                        customer: true,
                        stockMovements: {
                            where: { type: { in: ['OUT', 'USAGE'] } }
                        }
                    }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        }),
        // 2. Free/Warranty Parts (Not in Payments, but are important activities)
        db.stockMovement.findMany({
            where: {
                createdAt: { gte: dateStart, lte: dateEnd },
                ...whereBranch,
                type: 'OUT',
                isPaid: false // Avoid double counting paid parts which are already in payments
            },
            include: { branch: true },
            orderBy: { createdAt: 'desc' },
            take: parseInt(limit)
        })
    ]);

    // Manually fetch parts and requests for movements to get client info
    const partIds = [...new Set(freeParts.map(m => m.partId))];
    const movementRequestIds = [...new Set(freeParts.map(m => m.requestId).filter(Boolean))];

    const [parts, movementRequests] = await Promise.all([
        db.sparePart.findMany({ where: { id: { in: partIds } } }),
        db.maintenanceRequest.findMany({
            where: { id: { in: movementRequestIds } },
            include: { customer: true }
        })
    ]);
    const partsMap = Object.fromEntries(parts.map(p => [p.id, p]));
    const reqMap = Object.fromEntries(movementRequests.map(r => [r.id, r]));

    // Normalize Data
    const transactions = [];

    payments.forEach(p => {
        const t = p.type || '';
        const r = p.reason || '';
        const details = p.reason || p.notes || '';

        // Priority check for spare parts as requested: if details mention "قطع غيار" or the linked request consumed parts
        const producedParts = p.request?.stockMovements?.length > 0;
        const hasSpareParts = details.includes('قطع غيار') || producedParts;
        const isMachineRelated = !hasSpareParts && (t === 'INSTALLMENT' || t === 'SALE' || r.includes('قسط') || r.includes('بيع') || r.includes('ماكينة'));

        transactions.push({
            id: p.id,
            date: p.createdAt,
            type: t || 'payment',
            category: hasSpareParts ? 'Spare Parts' : (isMachineRelated ? 'Machine Sale' : 'Maintenance/General'),
            amount: p.amount,
            branch: p.branch?.name || 'N/A',
            client: p.customer?.client_name || p.request?.customer?.client_name || 'Walk-in',
            details: details || 'Payment received',
            status: 'PAID'
        });
    });

    // We omit machineSales.forEach to avoid double-counting, as machine sales 
    // already create corresponding Payment records for down payments.
    // We omit machineSales.forEach as they are represented by Payments.

    freeParts.forEach(m => {
        const part = partsMap[m.partId];
        const req = m.requestId ? reqMap[m.requestId] : null;
        if (!part) return;
        transactions.push({
            id: m.id,
            date: m.createdAt,
            type: 'SPARE_PART_WARRANTY',
            category: 'Spare Parts',
            amount: 0,
            branch: m.branch?.name || 'مكتب رئيسي',
            client: req?.customer?.client_name || 'N/A',
            details: `(ضمان/مجاني) ${m.quantity}x ${part.name}`,
            status: 'FREE'
        });
    });

    // Sort combined list by date desc
    transactions.sort((a, b) => {
        const dateA = new Date(a.date).getTime();
        const dateB = new Date(b.date).getTime();
        return (dateB || 0) - (dateA || 0);
    });

    res.json(transactions.slice(0, parseInt(limit)));
}));

/**
 * GET /stats/parts-usage
 * Report for Spare Parts: Paid vs Free
 */
router.get('/stats/parts-usage', authenticateToken, authorize(FINANCE_ROLES), asyncHandler(async (req, res) => {
    const { startDate, endDate, branchId } = req.query;

    const today = new Date();
    const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0);
    dateStart.setHours(0, 0, 0, 0);
    dateEnd.setHours(23, 59, 59, 999);

    const whereBranch = branchId ? { branchId } : {};

    // Fetch all OUT movements
    const movements = await db.stockMovement.findMany({
        where: {
            createdAt: { gte: dateStart, lte: dateEnd },
            ...(branchId ? { branchId } : {}),
            type: { in: ['OUT', 'USAGE'] }
        },
        include: {
            branch: true
        }
    });

    // Manually fetch parts, price logs, AND requests to get customer names
    const partIds = [...new Set(movements.map(m => m.partId))];
    const requestIdList = [...new Set(movements.map(m => m.requestId).filter(Boolean))];

    const [parts, priceLogs, movementRequests, branchDebts] = await Promise.all([
        db.sparePart.findMany({ where: { id: { in: partIds } } }),
        db.priceChangeLog.findMany({
            where: { partId: { in: partIds } },
            orderBy: { changedAt: 'desc' }
        }),
        db.maintenanceRequest.findMany({
            where: { id: { in: requestIdList } },
            include: { customer: true, payments: { select: { receiptNumber: true } } }
        }),
        db.branchDebt.findMany({
            where: { referenceId: { in: requestIdList } },
            select: { referenceId: true, receiptNumber: true }
        })
    ]);

    const partsMap = Object.fromEntries(parts.map(p => [p.id, p]));
    const requestMap = Object.fromEntries(movementRequests.map(r => [r.id, r]));
    const debtMap = Object.fromEntries(branchDebts.map(d => [d.referenceId, d]));

    // Process Report
    const reportData = movements.map(m => {
        const part = partsMap[m.partId];
        if (!part) return null;

        const req = m.requestId ? requestMap[m.requestId] : null;
        const debt = m.requestId ? debtMap[m.requestId] : null;

        // Find the price that was active at the time of movement
        const relevantLog = priceLogs
            .filter(log => log.partId === m.partId && new Date(log.changedAt) <= new Date(m.createdAt))[0];

        const isPaid = m.isPaid || false;
        const rawCost = relevantLog ? relevantLog.newCost : (part.defaultCost || 0);

        const cost = isPaid ? rawCost : 0;
        const totalValue = isPaid ? (Math.abs(m.quantity) * rawCost) : 0;

        let reqPaymentReceipt = null;
        if (req?.payments && req.payments.length > 0) {
            const pWithReceipt = req.payments.find(p => p.receiptNumber);
            if (pWithReceipt) reqPaymentReceipt = pWithReceipt.receiptNumber;
        }

        const effectiveReceipt = m.receiptNumber || reqPaymentReceipt || req?.receiptNumber || debt?.receiptNumber || '';

        return {
            id: m.id,
            date: m.createdAt,
            branch: m.branch?.name || 'مكتب رئيسي',
            partName: part.name,
            quantity: Math.abs(m.quantity),
            unitCost: cost,
            totalValue: totalValue,
            isPaid: isPaid,
            type: isPaid ? 'مدفوع' : 'مجاني/ضمان',
            revenueStatus: isPaid ? 'إيراد فعلي' : 'تكلفة خدمة',
            client: req?.customer?.client_name || req?.customerName || 'N/A',
            clientBkcode: req?.customer?.bkcode || req?.customerBkcode || 'N/A',
            machineSerial: req?.serialNumber || 'N/A',
            receiptNumber: isPaid ? effectiveReceipt : ''
        };
    }).filter(Boolean);

    res.json(reportData);
}));

/**
 * GET /stats/installments
 * Detailed Installments and Debt Report
 */
router.get('/stats/installments', authenticateToken, authorize(FINANCE_ROLES), asyncHandler(async (req, res) => {
    const { branchId } = req.query;
    const today = new Date();

    const where = {};
    if (branchId) {
        where.branchId = branchId;
    }

    // 1. Fetch Sales with Installments
    const sales = await db.machineSale.findMany({
        where: {
            ...where,
            type: 'INSTALLMENT'
        },
        include: {
            customer: true,
            branch: true,
            installments: {
                orderBy: { dueDate: 'asc' }
            }
        }
    });

    // 2. Aggregate Data
    let totalPortfolio = 0;
    let totalCollected = 0;
    let totalOverdue = 0;
    let totalPending = 0;

    // Branch Performance Map
    const branchStats = {};

    const details = [];

    for (const sale of sales) {
        const bName = sale.branch?.name || 'Unknown';

        // Init branch stats if needed
        if (!branchStats[bName]) {
            branchStats[bName] = {
                id: sale.branchId,
                name: bName,
                total: 0,
                collected: 0,
                overdue: 0,
                pending: 0,
                customersCount: new Set()
            };
        }

        sale.installments.forEach(inst => {
            const amount = inst.amount || 0;
            const isPaid = inst.isPaid;
            const isOverdue = !isPaid && new Date(inst.dueDate) < today;

            // Global Totals
            totalPortfolio += amount;
            if (isPaid) totalCollected += amount;
            else if (isOverdue) totalOverdue += amount;
            else totalPending += amount;

            // Branch Stats
            branchStats[bName].total += amount;
            if (isPaid) branchStats[bName].collected += amount;
            else if (isOverdue) branchStats[bName].overdue += amount;
            else branchStats[bName].pending += amount;

            branchStats[bName].customersCount.add(sale.customerId);

            // Detail Row (Only relevant items)
            if (!isPaid) {
                details.push({
                    id: inst.id,
                    saleId: sale.id,
                    customerName: sale.customer.client_name,
                    branchName: bName,
                    amount: amount,
                    dueDate: inst.dueDate,
                    status: isOverdue ? 'OVERDUE' : 'PENDING',
                    daysOverdue: isOverdue ? Math.ceil((today - new Date(inst.dueDate)) / (1000 * 60 * 60 * 24)) : 0,
                    phone: sale.customer.telephone_1
                });
            }
        });
    }

    // Format Branch Stats (convert Set to count)
    const formattedBranchStats = Object.values(branchStats).map(b => ({
        ...b,
        customersCount: b.customersCount.size,
        collectionRate: b.total > 0 ? Math.round((b.collected / b.total) * 100) : 0
    })).sort((a, b) => b.overdue - a.overdue); // Sort by highest overdue first

    // Sort Details by Overdue Amount (Highest to Lowest)
    details.sort((a, b) => b.daysOverdue - a.daysOverdue);

    res.json({
        kpi: {
            totalPortfolio,
            collected: totalCollected,
            overdue: totalOverdue,
            pending: totalPending,
            collectionRate: totalPortfolio > 0 ? Math.round((totalCollected / totalPortfolio) * 100) : 0
        },
        branchPerformance: formattedBranchStats,
        details // detailed list of unpaid items
    });
}));


/**
 * GET /stats/sales-report
 * Detailed report for Machine Sales (Cash, Downpayments, Installment Dues)
 */
router.get('/stats/sales-report', authenticateToken, authorize(FINANCE_ROLES), asyncHandler(async (req, res) => {
    const { startDate, endDate, branchId } = req.query;

    const today = new Date();
    const dateStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1);
    const dateEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0);
    dateStart.setHours(0, 0, 0, 0);
    dateEnd.setHours(23, 59, 59, 999);

    const whereBranch = branchId ? { branchId } : {};

    const machineSales = await db.machineSale.findMany({
        where: {
            saleDate: { gte: dateStart, lte: dateEnd },
            status: { not: 'DELETED' },
            ...whereBranch
        },
        include: {
            customer: true,
            branch: true
        }
    });

    // 2. Fetch Installment Payments
    const paidInstallments = await db.installment.findMany({
        where: {
            OR: [
                { paidAt: { gte: dateStart, lte: dateEnd } },
                { paidAt: null, dueDate: { gte: dateStart, lte: dateEnd } }
            ],
            isPaid: true,
            ...whereBranch
        },
        include: {
            branch: true,
            sale: { include: { customer: true } }
        }
    });

    const reportData = [];

    machineSales.forEach(sale => {
        reportData.push({
            id: `sale-${sale.id}`,
            date: sale.saleDate,
            branch: sale.branch?.name || 'مكتب رئيسي',
            client: sale.customer?.client_name || 'N/A',
            clientBkcode: sale.customer?.bkcode || 'N/A',
            machineSerial: sale.serialNumber || 'N/A',
            type: sale.type === 'CASH' ? 'مبيعات كاش' : 'مقدم قسط',
            amount: sale.type === 'CASH' ? sale.totalPrice : sale.paidAmount,
            receiptNumber: sale.notes || ''
        });
    });

    paidInstallments.forEach(inst => {
        reportData.push({
            id: `inst-${inst.id}`,
            date: inst.paidAt || inst.dueDate,
            branch: inst.branch?.name || 'مكتب رئيسي',
            client: inst.sale?.customer?.client_name || 'N/A',
            clientBkcode: inst.sale?.customer?.bkcode || 'N/A',
            machineSerial: inst.sale?.serialNumber || 'N/A',
            type: 'دفعة قسط',
            amount: inst.paidAmount || inst.amount,
            receiptNumber: inst.receiptNumber || ''
        });
    });

    reportData.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json(reportData);
}));

module.exports = router;
