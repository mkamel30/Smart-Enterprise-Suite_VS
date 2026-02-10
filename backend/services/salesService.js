const db = require('../db');
const { roundMoney } = require('./paymentService');
const { getBranchFilter } = require('../middleware/permissions');
const { ensureSerialNotAssignedToCustomer } = require('./serialService');
const { AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

/**
 * Service to handle all machine sales and installments logic
 */
const salesService = {
    /**
     * Get all sales with branch filtering
     */
    async getAllSales(req) {
        const branchFilter = getBranchFilter(req);
        return await db.machineSale.findMany(ensureBranchWhere({
            where: branchFilter,
            include: {
                customer: true,
                installments: true
            },
            orderBy: { saleDate: 'desc' }
        }, req));
    },

    /**
     * Get installments with filters
     */
    async getInstallments(req, { overdue }) {
        const branchFilter = getBranchFilter(req);
        let where = { ...branchFilter };

        if (overdue === 'true') {
            where.isPaid = false;
            where.dueDate = { lt: new Date() };
        }

        return await db.installment.findMany(ensureBranchWhere({
            where,
            include: {
                sale: {
                    include: { customer: true }
                }
            },
            orderBy: { dueDate: 'asc' }
        }, req));
    },

    /**
     * Get Dashboard Stats
     */
    async getDashboardStats(req) {
        const branchFilter = getBranchFilter(req);
        const today = new Date();

        // 1. Active Installment Sales Stats
        const activeSales = await db.machineSale.findMany(ensureBranchWhere({
            where: {
                ...branchFilter,
                type: 'INSTALLMENT',
                status: 'ONGOING'
            },
            select: {
                customerId: true,
                _count: {
                    select: { installments: true }
                }
            }
        }, req));

        const customersCount = new Set(activeSales.map(s => s.customerId)).size;

        // Calculate average months
        const totalInstallmentsInActiveSales = activeSales.reduce((acc, s) => acc + s._count.installments, 0);
        const avgMonths = activeSales.length > 0
            ? Math.round(totalInstallmentsInActiveSales / activeSales.length)
            : 0;

        // 2. Financials (Total Unpaid Value)
        const unpaidStats = await db.installment.aggregate({
            _sum: { amount: true },
            _count: { id: true },
            where: ensureBranchWhere({
                where: {
                    ...branchFilter,
                    isPaid: false,
                    sale: { status: { not: 'COMPLETED' } }
                }
            }, req).where
        });

        // 3. Overdue Stats
        const overdueInstallments = await db.installment.findMany(ensureBranchWhere({
            where: {
                ...branchFilter,
                isPaid: false,
                dueDate: { lt: today }
            },
            select: {
                id: true,
                amount: true,
                sale: {
                    select: { customerId: true }
                }
            }
        }, req));

        const overdueCount = overdueInstallments.length;
        const overdueValue = overdueInstallments.reduce((sum, i) => sum + i.amount, 0);
        const overdueCustomersCount = new Set(overdueInstallments.map(i => i.sale?.customerId)).size;

        return {
            customersCount,
            totalInstallments: unpaidStats._count.id || 0,
            totalValue: unpaidStats._sum.amount || 0,
            avgMonths,
            overdueCount,
            overdueValue,
            overdueCustomersCount
        };
    },

    /**
     * Create a new machine sale
     */
    async createSale(saleData, user, req) {
        const {
            serialNumber,
            customerId,
            type,
            totalPrice,
            paidAmount,
            notes,
            installmentCount,
            performedBy = 'System',
            paymentMethod,
            paymentPlace,
            receiptNumber
        } = saleData;

        const { canAccessBranch } = require('../middleware/permissions');
        const branchId = saleData.branchId || user.branchId;
        if (!branchId) throw new AppError('معرف الفرع مطلوب', 400);

        if (!await canAccessBranch({ user }, branchId, db)) {
            throw new AppError('ليس لديك صلاحية الوصول لهذا الفرع', 403);
        }

        // 1. Validation
        if (parseFloat(paidAmount) > 0) {
            if (!paymentMethod && !paymentPlace) throw new AppError('يجب اختيار مكان الدفع', 400);
            if (!receiptNumber || receiptNumber.trim() === '') throw new AppError('يجب إدخال رقم الإيصال', 400);
        }

        // 2. Receipt Check
        if (receiptNumber) {
            const existingReceipt = await db.payment.findFirst(ensureBranchWhere({
                where: { receiptNumber }
            }, req));
            if (existingReceipt) throw new AppError('رقم الإيصال موجود بالفعل في سجل المدفوعات', 400);
        }

        // 3. Machine Check
        const machine = await db.warehouseMachine.findFirst(ensureBranchWhere({
            where: { serialNumber }
        }, req));
        if (!machine) throw new NotFoundError('الماكينة');
        if (!await canAccessBranch({ user }, machine.branchId, db)) throw new AppError('ليس لديك صلاحية الوصول لهذه الماكينة', 403);
        if (machine.status === 'SOLD') throw new AppError('هذه الماكينة مباعة بالفعل', 400);

        // 4. Serial conflict check
        await ensureSerialNotAssignedToCustomer(serialNumber);

        // 5. Customer Check
        const customerBkcode = String(customerId).trim();
        const customer = await db.customer.findFirst(ensureBranchWhere({
            where: { bkcode: customerBkcode }
        }, req));
        if (!customer) throw new NotFoundError('الالعميل');
        if (!await canAccessBranch({ user }, customer.branchId, db)) throw new AppError('ليس لديك صلاحية الوصول لهذا العميل', 403);

        const actualCustomerId = customer.id;

        // 6. Transactional Sale Execution
        const result = await db.$transaction(async (tx) => {
            const roundedTotalPrice = roundMoney(totalPrice);
            const roundedPaidAmount = roundMoney(paidAmount);

            // A. Create Sale Record
            const sale = await tx.machineSale.create({
                data: {
                    branchId,
                    serialNumber,
                    customerId: actualCustomerId,
                    type,
                    totalPrice: roundedTotalPrice,
                    paidAmount: roundedPaidAmount,
                    status: type === 'CASH' ? 'COMPLETED' : 'ONGOING',
                    notes
                }
            });

            // B. Generate Installments if needed
            if (type === 'INSTALLMENT' && installmentCount > 0) {
                const totalRemaining = roundMoney(roundedTotalPrice - roundedPaidAmount);
                const monthlyAmount = roundMoney(totalRemaining / installmentCount);
                const today = new Date();
                let sumOfInstallments = 0;

                for (let i = 1; i <= installmentCount; i++) {
                    const dueDate = new Date(today);
                    dueDate.setMonth(dueDate.getMonth() + i);

                    let amountToCharge = monthlyAmount;
                    if (i === installmentCount) {
                        amountToCharge = roundMoney(totalRemaining - sumOfInstallments);
                    }

                    await tx.installment.create({
                        data: {
                            saleId: sale.id,
                            branchId,
                            dueDate,
                            amount: amountToCharge,
                            isPaid: false,
                            description: `القسط رقم ${i} من ${installmentCount}`
                        }
                    });
                    sumOfInstallments = roundMoney(sumOfInstallments + amountToCharge);
                }
            }

            // C. Update Warehouse Machine
            await tx.warehouseMachine.updateMany({
                where: { id: machine.id, branchId: machine.branchId },
                data: { status: 'SOLD' }
            });

            // D. Create PosMachine record
            await tx.posMachine.create({
                data: {
                    serialNumber: machine.serialNumber,
                    model: machine.model,
                    manufacturer: machine.manufacturer,
                    customerId: actualCustomerId,
                    branchId,
                    isMain: false
                }
            });

            // E. Log Movement
            await tx.machineMovementLog.create({
                data: {
                    machineId: machine.id,
                    serialNumber: machine.serialNumber,
                    action: 'SELL',
                    details: JSON.stringify({
                        sale: {
                            id: sale.id,
                            type: type,
                            totalPrice: roundedTotalPrice,
                            paidAmount: roundedPaidAmount,
                            saleDate: sale.saleDate,
                            serialNumber: machine.serialNumber,
                            model: machine.model,
                            manufacturer: machine.manufacturer,
                            paymentMethod: paymentPlace || paymentMethod || 'التزام',
                            notes: notes || '',
                            customer: {
                                id: actualCustomerId,
                                client_name: customer.client_name,
                                bkcode: customer.bkcode
                            }
                        }
                    }),
                    performedBy: performedBy || user.displayName || user.name || 'System',
                    branchId: branchId
                }
            });

            // F. Create Payment record
            if (roundedPaidAmount > 0) {
                await tx.payment.create({
                    data: {
                        branchId,
                        customerId: actualCustomerId,
                        customerName: customer.client_name,
                        amount: roundedPaidAmount,
                        reason: `بيع ماكينة ${serialNumber}`,
                        type: 'SALE',
                        paymentPlace: paymentPlace || paymentMethod || 'التزام',
                        receiptNumber,
                        notes: `دفعة ${type === 'CASH' ? 'كاملة' : 'مقدم'} - ${notes || ''}`,
                        userId: user.id,
                        userName: user.displayName || performedBy || user.name || 'System',
                        createdAt: new Date()
                    }
                });
            }

            return await tx.machineSale.findFirst({
                where: { id: sale.id, branchId },
                include: { installments: true, customer: true }
            });
        });

        return {
            ...result,
            model: machine.model,
            manufacturer: machine.manufacturer,
            paymentMethod: paymentPlace || paymentMethod || 'التزام',
            receiptNumber
        };
    },

    /**
     * Pay a specific installment
     */
    async payInstallment(id, { amount, receiptNumber, paymentPlace }, user, req) {
        if (!paymentPlace) throw new AppError('يجب اختيار مكان الدفع', 400);
        if (!receiptNumber || receiptNumber.trim() === '') throw new AppError('يجب إدخال رقم الإيصال', 400);

        // 1. Receipt Duplication Checks
        const existingPayment = await db.payment.findFirst(ensureBranchWhere({
            where: { receiptNumber: receiptNumber.trim() }
        }, req));
        if (existingPayment) throw new AppError('رقم الإيصال مستخدم من قبل في سجلات المدفوعات', 400);

        const existingInstallment = await db.installment.findFirst(ensureBranchWhere({
            where: { receiptNumber: receiptNumber.trim(), isPaid: true }
        }, req));
        if (existingInstallment) throw new AppError('رقم الإيصال مستخدم من قبل في الأقساط', 400);

        // 2. Fetch Installment
        const { canAccessBranch } = require('../middleware/permissions');
        const existing = await db.installment.findFirst({
            where: { id, branchId: { not: null } },
            include: { sale: { include: { customer: true } } }
        });
        if (!existing) throw new NotFoundError('القسط');
        if (!await canAccessBranch({ user }, existing.branchId, db)) throw new AppError('Access denied', 403);

        // 3. Execute Payment Transaction
        const result = await db.$transaction(async (tx) => {
            const payAmount = amount || existing.amount;

            await tx.installment.updateMany({
                where: { id, branchId: { not: null } },
                data: {
                    isPaid: true,
                    paidAt: new Date(),
                    paidAmount: payAmount,
                    receiptNumber: receiptNumber.trim(),
                    paymentPlace
                }
            });

            await tx.machineSale.updateMany({
                where: { id: existing.saleId, branchId: existing.sale?.branchId || { not: null } },
                data: { paidAmount: { increment: payAmount } }
            });

            let paymentRecord = null;
            if (existing.sale?.customer) {
                paymentRecord = await tx.payment.create({
                    data: {
                        branchId: existing.branchId || existing.sale.branchId || user.branchId,
                        customerId: existing.sale.customerId,
                        customerName: existing.sale.customer.client_name,
                        amount: payAmount,
                        type: 'INSTALLMENT',
                        reason: existing.description || 'سداد قسط',
                        paymentPlace,
                        receiptNumber: receiptNumber.trim(),
                        notes: `سداد ${existing.description}`,
                        userId: user.id,
                        userName: user.displayName || user.name || 'System'
                    }
                });
            }

            return { paymentRecord };
        });

        // 4. Post-transaction logging
        await logAction({
            entityType: 'INSTALLMENT',
            entityId: id,
            action: 'PAY',
            details: `سداد قسط بقيمة ${amount || existing.amount} - إيصال ${receiptNumber}`,
            userId: user.id,
            performedBy: user.displayName || user.name || 'System',
            branchId: existing.branchId || existing.sale.branchId || user.branchId
        });

        return { success: true };
    },

    /**
     * Recalculate future installments
     */
    async recalculateInstallments(saleId, { newCount }, user) {
        const sale = await db.machineSale.findFirst({
            where: { id: saleId, branchId: { not: null } },
            include: { installments: true }
        });

        if (!sale) throw new NotFoundError('العملية');
        const { canAccessBranch } = require('../middleware/permissions');
        if (!await canAccessBranch({ user }, sale.branchId, db)) throw new AppError('ليس لديك صلاحية الوصول', 403);

        const totalRemaining = roundMoney(sale.totalPrice - sale.paidAmount);
        if (totalRemaining <= 0) throw new AppError('لا يوجد مبالغ متبقية لإعادة الجدولة', 400);

        const installments = await db.$transaction(async (tx) => {
            await tx.installment.deleteMany({
                where: { saleId, isPaid: false, branchId: user.branchId || sale.branchId }
            });

            const installmentAmount = roundMoney(totalRemaining / newCount);
            const today = new Date();
            const news = [];
            let sumOfNew = 0;

            for (let i = 1; i <= newCount; i++) {
                const dueDate = new Date(today);
                dueDate.setMonth(dueDate.getMonth() + i);

                let amountToCharge = installmentAmount;
                if (i === newCount) {
                    amountToCharge = roundMoney(totalRemaining - sumOfNew);
                }

                const inst = await tx.installment.create({
                    data: {
                        saleId,
                        branchId: user.branchId || sale.branchId,
                        amount: amountToCharge,
                        dueDate,
                        description: `القسط رقم ${i} من ${newCount}`
                    }
                });
                news.push(inst);
                sumOfNew = roundMoney(sumOfNew + amountToCharge);
            }
            return news;
        });

        await logAction({
            entityType: 'SALE',
            entityId: saleId,
            action: 'RECALCULATE_INSTALLMENTS',
            details: `إعادة حساب الأقساط - المتبقي: ${totalRemaining} - عدد الأقساط الجديدة: ${newCount}`,
            userId: user.id,
            performedBy: user.displayName || user.name || 'System',
            branchId: user.branchId || sale.branchId
        });

        return installments;
    },

    /**
     * Delete (Void) a sale
     */
    async deleteSale(id, user) {
        const sale = await db.machineSale.findFirst({
            where: { id, branchId: { not: null } },
            include: { installments: true }
        });

        if (!sale) throw new NotFoundError('العملية');
        const { canAccessBranch } = require('../middleware/permissions');
        if (!await canAccessBranch({ user }, sale.branchId, db)) throw new AppError('ليس لديك صلاحية الوصول', 403);

        await db.$transaction(async (tx) => {
            // 1. Delete all installments
            await tx.installment.deleteMany({ where: { saleId: id, branchId: sale.branchId } });

            // 2. Delete associated payments
            await tx.payment.deleteMany({
                where: {
                    customerId: sale.customerId,
                    branchId: sale.branchId,
                    type: 'SALE',
                    reason: `بيع ماكينة ${sale.serialNumber}`
                }
            });

            // 3. Delete PosMachine
            const posMachine = await tx.posMachine.findFirst({
                where: { serialNumber: sale.serialNumber, branchId: sale.branchId }
            });

            if (posMachine && posMachine.customerId === sale.customerId) {
                await tx.posMachine.deleteMany({ where: { id: posMachine.id, branchId: sale.branchId } });
            }

            // 4. Restore Warehouse Machine
            const warehouseMachine = await tx.warehouseMachine.findFirst({
                where: { serialNumber: sale.serialNumber, branchId: sale.branchId }
            });

            if (warehouseMachine) {
                await tx.warehouseMachine.updateMany({
                    where: { id: warehouseMachine.id, branchId: warehouseMachine.branchId },
                    data: { status: 'NEW' }
                });

                // 5. Log void
                await tx.machineMovementLog.create({
                    data: {
                        machineId: warehouseMachine.id,
                        serialNumber: warehouseMachine.serialNumber,
                        action: 'SALE_VOID',
                        details: `إلغاء البيع وإعادة الماكينة للمخزن - العميل: ${sale.customerId}`,
                        performedBy: user.displayName || user.name || 'Admin',
                        branchId: user.branchId || sale.branchId
                    }
                });
            }

            // 6. Delete the Sale record
            await tx.machineSale.deleteMany({ where: { id, branchId: sale.branchId } });
        });

        return { success: true };
    }
};

module.exports = salesService;
