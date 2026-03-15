const express = require('express');
const router = express.Router();
const db = require('../../../../db');
const { authenticateToken } = require('../../../../middleware/auth');
const { isGlobalRole } = require('../../../../utils/constants');
const { success, error } = require('../../../../utils/apiResponse');
const { asyncHandler } = require('../../../../utils/errorHandler');

/**
 * GET /reports/monthly-closing
 * Monthly Closing Report for a branch
 * Query: month (YYYY-MM), branchId (optional, for admin override)
 */
router.get('/monthly-closing', authenticateToken, asyncHandler(async (req, res) => {
    const { month } = req.query;
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return error(res, 'الشهر مطلوب بصيغة YYYY-MM', 400);
    }

    const [year, mon] = month.split('-').map(Number);
    const startDate = new Date(year, mon - 1, 1);
    const endDate = new Date(year, mon, 0, 23, 59, 59, 999); // Last day of month
    const today = new Date();

    // Determine branch
    const targetBranchId = (isGlobalRole(req.user.role) && req.query.branchId)
        ? req.query.branchId
        : req.user.branchId;

    let allBranchIds = [];
    let branchInfo = null;
    let childBranchesList = [];

    if (targetBranchId) {
        // Get specific branch info + child branches
        const branch = await db.branch.findUnique({
            where: { id: targetBranchId },
            include: {
                childBranches: { where: { isActive: true }, select: { id: true, name: true, code: true } }
            }
        });
        if (!branch) return error(res, 'الفرع غير موجود', 404);
        
        branchInfo = { id: branch.id, name: branch.name, code: branch.code };
        childBranchesList = branch.childBranches;
        allBranchIds = [targetBranchId, ...branch.childBranches.map(c => c.id)];
    } else if (isGlobalRole(req.user.role)) {
        // Fallback for global admin with no branch selected: use all branches
        const allBranches = await db.branch.findMany({
            where: { isActive: true },
            select: { id: true, name: true, code: true }
        });
        branchInfo = { id: 'ALL', name: 'الشركة (الكل)', code: 'ALL' };
        childBranchesList = allBranches;
        allBranchIds = allBranches.map(b => b.id);
    } else {
        return error(res, 'Branch ID required', 400);
    }

    const dateFilter = { gte: startDate, lte: endDate };

    // =================== PARALLEL DATA FETCH ===================
    const [
        // Section 1: Sales
        cashSales,
        installmentSales,
        // Section 2: Installments
        collectedInstallments,
        overdueInstallments,
        upcomingInstallments,
        // Section 3: Spare Parts
        paidParts,
        freeParts,
        usedPartLogs,
        // Section 4: Inventory
        machineCount,
        simCount,
        outgoingTransfers,
        incomingTransfers,
        // Per-child branch sales (for hierarchy)
        childBranchData
    ] = await Promise.all([
        // ---- Sales ----
        db.machineSale.findMany({
            where: { branchId: { in: allBranchIds }, saleDate: dateFilter, type: 'CASH' },
            include: { customer: { select: { client_name: true, bkcode: true } } },
            orderBy: { saleDate: 'desc' }
        }),
        db.machineSale.findMany({
            where: { branchId: { in: allBranchIds }, saleDate: dateFilter, type: 'INSTALLMENT' },
            include: { customer: { select: { client_name: true, bkcode: true } } },
            orderBy: { saleDate: 'desc' }
        }),

        // ---- Installments ----
        db.installment.findMany({
            where: { branchId: { in: allBranchIds }, isPaid: true, paidAt: dateFilter },
            include: { sale: { include: { customer: { select: { client_name: true, bkcode: true } } } } },
            orderBy: { paidAt: 'desc' }
        }),
        db.installment.findMany({
            where: { branchId: { in: allBranchIds }, isPaid: false, dueDate: { lt: endDate } },
            include: { sale: { include: { customer: { select: { client_name: true, bkcode: true } } } } },
            orderBy: { dueDate: 'asc' }
        }),
        db.installment.findMany({
            where: { branchId: { in: allBranchIds }, isPaid: false, dueDate: { gt: endDate } },
            include: { sale: { include: { customer: { select: { client_name: true, bkcode: true } } } } },
            orderBy: { dueDate: 'asc' },
            take: 50
        }),

        // ---- Spare Parts ----
        db.stockMovement.findMany({
            where: { branchId: { in: allBranchIds }, type: 'OUT', isPaid: true, createdAt: dateFilter },
            include: {
                request: { select: { customerName: true, customerBkcode: true } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        db.stockMovement.findMany({
            where: { branchId: { in: allBranchIds }, type: 'OUT', isPaid: false, createdAt: dateFilter },
            include: {
                request: { select: { customerName: true, customerBkcode: true } }
            },
            orderBy: { createdAt: 'desc' }
        }),
        db.usedPartLog.findMany({
            where: { branchId: { in: allBranchIds }, closedAt: dateFilter },
            orderBy: { closedAt: 'desc' }
        }),

        // ---- Inventory Snapshot ----
        db.warehouseMachine.count({
            where: { branchId: { in: allBranchIds }, status: 'IN_STOCK' }
        }),
        db.warehouseSim.count({
            where: { branchId: { in: allBranchIds }, status: 'ACTIVE' }
        }),
        db.transferOrder.count({
            where: { fromBranchId: { in: allBranchIds }, createdAt: dateFilter }
        }),
        db.transferOrder.count({
            where: { toBranchId: { in: allBranchIds }, createdAt: dateFilter }
        }),

        // ---- Child Branch Breakdown ----
        childBranchesList.length > 0
            ? Promise.all(childBranchesList.map(async (child) => {
                const [sales, installments, parts] = await Promise.all([
                    db.machineSale.aggregate({
                        where: { branchId: child.id, saleDate: dateFilter },
                        _sum: { totalPrice: true, paidAmount: true },
                        _count: true
                    }),
                    db.installment.aggregate({
                        where: { branchId: child.id, isPaid: true, paidAt: dateFilter },
                        _sum: { paidAmount: true },
                        _count: true
                    }),
                    db.stockMovement.count({
                        where: { branchId: child.id, type: 'OUT', createdAt: dateFilter }
                    })
                ]);
                return {
                    branchId: child.id,
                    branchName: child.name,
                    branchCode: child.code,
                    sales: {
                        count: sales._count,
                        totalPrice: sales._sum.totalPrice || 0,
                        paidAmount: sales._sum.paidAmount || 0
                    },
                    installmentsCollected: {
                        count: installments._count,
                        amount: installments._sum.paidAmount || 0
                    },
                    partsOut: parts
                };
            }))
            : []
    ]);

    // =================== BUILD RESPONSE ===================

    // Sales Summary
    const cashTotal = cashSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const cashPaid = cashSales.reduce((sum, s) => sum + s.paidAmount, 0);
    const installmentTotal = installmentSales.reduce((sum, s) => sum + s.totalPrice, 0);
    const installmentPaid = installmentSales.reduce((sum, s) => sum + s.paidAmount, 0);

    // Installments Summary
    const collectedTotal = collectedInstallments.reduce((sum, i) => sum + (i.paidAmount || i.amount), 0);
    const overdueTotal = overdueInstallments.reduce((sum, i) => sum + i.amount, 0);
    const upcomingTotal = upcomingInstallments.reduce((sum, i) => sum + i.amount, 0);

    // Spare Parts Summary - parse parts JSON from UsedPartLog
    // Split individual parts into paid vs free categories
    let totalPaidPartsValue = 0;
    let totalFreePartsValue = 0; // actual value of free parts (cost * qty)
    const partFrequencyMap = {}; // Track part consumption frequency
    const paidPartItems = []; // Individual paid parts from all logs
    const freePartItems = []; // Individual free parts from all logs

    const parsedUsedParts = usedPartLogs.map(log => {
        let parts = [];
        try { parts = JSON.parse(log.parts || '[]'); } catch (e) { parts = []; }

        // Split parts within this log into paid and free
        parts.forEach(p => {
            const partName = p.name || p.partName || 'غير معروف';
            const qty = p.quantity || 1;
            const unitCost = parseFloat(p.cost) || 0;
            const isPaid = !!p.isPaid;

            const partItem = {
                partName,
                quantity: qty,
                unitCost,
                totalValue: unitCost * qty,
                customerName: log.customerName,
                customerBkcode: log.customerBkcode,
                technician: log.technician,
                closedAt: log.closedAt,
                receiptNumber: log.receiptNumber,
                requestId: log.requestId
            };

            if (isPaid) {
                totalPaidPartsValue += unitCost * qty;
                paidPartItems.push(partItem);
            } else {
                totalFreePartsValue += unitCost * qty; // actual value even if free
                freePartItems.push(partItem);
            }

            // Aggregate part consumption frequency
            if (!partFrequencyMap[partName]) {
                partFrequencyMap[partName] = { name: partName, totalQuantity: 0, totalCost: 0, paidCount: 0, freeCount: 0 };
            }
            partFrequencyMap[partName].totalQuantity += qty;
            partFrequencyMap[partName].totalCost += unitCost * qty;
            if (isPaid) partFrequencyMap[partName].paidCount += qty;
            else partFrequencyMap[partName].freeCount += qty;
        });

        const totalCost = parts.reduce((s, p) => s + ((parseFloat(p.cost) || 0) * (p.quantity || 1)), 0);
        return {
            ...log,
            parsedParts: parts,
            totalCost
        };
    });

    // Top consumed parts - sorted by quantity descending
    const topParts = Object.values(partFrequencyMap)
        .sort((a, b) => b.totalQuantity - a.totalQuantity)
        .slice(0, 15);

    const result = {
        month,
        branch: branchInfo,
        hasChildBranches: childBranchesList.length > 0,

        // Section 1: Sales
        sales: {
            cash: {
                count: cashSales.length,
                totalPrice: cashTotal,
                paidAmount: cashPaid,
                remaining: cashTotal - cashPaid,
                details: cashSales.map(s => ({
                    id: s.id,
                    serialNumber: s.serialNumber,
                    customerName: s.customer?.client_name,
                    customerCode: s.customer?.bkcode,
                    saleDate: s.saleDate,
                    totalPrice: s.totalPrice,
                    paidAmount: s.paidAmount,
                    status: s.status
                }))
            },
            installment: {
                count: installmentSales.length,
                totalPrice: installmentTotal,
                paidAmount: installmentPaid,
                remaining: installmentTotal - installmentPaid,
                details: installmentSales.map(s => ({
                    id: s.id,
                    serialNumber: s.serialNumber,
                    customerName: s.customer?.client_name,
                    customerCode: s.customer?.bkcode,
                    saleDate: s.saleDate,
                    totalPrice: s.totalPrice,
                    paidAmount: s.paidAmount,
                    status: s.status
                }))
            },
            totalRevenue: cashTotal + installmentTotal,
            totalCollected: cashPaid + installmentPaid
        },

        // Section 2: Installments
        installments: {
            collected: {
                count: collectedInstallments.length,
                totalAmount: collectedTotal,
                details: collectedInstallments.map(i => ({
                    id: i.id,
                    amount: i.paidAmount || i.amount,
                    paidAt: i.paidAt,
                    receiptNumber: i.receiptNumber,
                    customerName: i.sale?.customer?.client_name,
                    customerCode: i.sale?.customer?.bkcode
                }))
            },
            overdue: {
                count: overdueInstallments.length,
                totalAmount: overdueTotal,
                details: overdueInstallments.map(i => ({
                    id: i.id,
                    amount: i.amount,
                    dueDate: i.dueDate,
                    customerName: i.sale?.customer?.client_name,
                    customerCode: i.sale?.customer?.bkcode,
                    daysOverdue: Math.floor((today.getTime() - new Date(i.dueDate).getTime()) / (1000 * 60 * 60 * 24))
                }))
            },
            upcoming: {
                count: upcomingInstallments.length,
                totalAmount: upcomingTotal,
                details: upcomingInstallments.map(i => ({
                    id: i.id,
                    amount: i.amount,
                    dueDate: i.dueDate,
                    customerName: i.sale?.customer?.client_name,
                    customerCode: i.sale?.customer?.bkcode
                }))
            }
        },

        // Section 3: Spare Parts (split by paid vs free at per-part level)
        spareParts: {
            paid: {
                count: paidPartItems.length,
                totalValue: totalPaidPartsValue,
                details: paidPartItems
            },
            free: {
                count: freePartItems.length,
                totalValue: totalFreePartsValue, // actual value of free parts
                details: freePartItems
            },
            topParts
        },

        // Section 4: Inventory Snapshot
        inventory: {
            machines: machineCount,
            sims: simCount,
            outgoingTransfers,
            incomingTransfers
        },

        // Section 5: Overall Summary
        summary: {
            totalMonthlyRevenue: cashPaid + installmentPaid + collectedTotal,
            totalSalesValue: cashTotal + installmentTotal,
            totalOverdueAmount: overdueTotal,
            totalPaidParts: totalPaidPartsValue,
            totalFreeParts: totalFreePartsValue,
            totalPartsValue: totalPaidPartsValue + totalFreePartsValue
        },

        // Child Branches (if any)
        childBranches: childBranchData
    };

    return success(res, result);
}));

module.exports = router;
