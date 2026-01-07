const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { ensureSerialNotAssignedToCustomer, getSerialConflicts } = require('../services/serialService');

// Import roundMoney from centralized payment service
const { roundMoney } = require('../services/paymentService');

// Helper to get branch filter
const getBranchFilter = (req) => {
    if (!req.user || !req.user.branchId) return {};
    return { branchId: req.user.branchId };
};

// GET All Sales
router.get('/', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);
        const sales = await db.machineSale.findMany({
            where,
            include: {
                customer: true,
                installments: true
            },
            orderBy: { saleDate: 'desc' }
        });
        res.json(sales);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch sales' });
    }
});

// GET Installments (due or all)
router.get('/installments', authenticateToken, async (req, res) => {
    try {
        const { overdue } = req.query;
        let where = {};

        if (overdue === 'true') {
            where = {
                isPaid: false,
                dueDate: { lt: new Date() }
            };
        }

        // Apply branch filter
        Object.assign(where, getBranchFilter(req));

        const installments = await db.installment.findMany({
            where,
            include: {
                sale: {
                    include: { customer: true }
                }
            },
            orderBy: { dueDate: 'asc' }
        });
        res.json(installments);
    } catch (error) {
        console.error('Failed to fetch installments:', error);
        res.status(500).json({ error: 'Failed to fetch installments' });
    }
});

// POST Create Sale
router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            serialNumber,
            customerId,
            type, // CASH, INSTALLMENT
            totalPrice,
            paidAmount,
            notes,
            installmentCount, // Optional: number of months
            performedBy = 'System',
            paymentMethod,
            paymentPlace
        } = req.body;

        // Ensure branchId is valid (string type in schema)
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
            console.warn('Sale creation failed: No valid branchId provided', { user: req.user, body: req.body });
            return res.status(400).json({ error: 'Branch ID required' });
        }

        // Payment Validation
        if (parseFloat(paidAmount) > 0) {
            if (!paymentMethod && !paymentPlace) {
                return res.status(400).json({ error: 'يجب اختيار مكان الدفع' });
            }
            if (!req.body.receiptNumber || req.body.receiptNumber.trim() === '') {
                return res.status(400).json({ error: 'يجب إدخال رقم الإيصال' });
            }
        }

        // 1. Validate Receipt Number (Backend Check) - BEFORE transaction
        if (req.body.receiptNumber) {
            const existingReceipt = await db.payment.findFirst({
                where: { receiptNumber: req.body.receiptNumber },
                __allow_unscoped: true
            });
            if (existingReceipt) {
                return res.status(400).json({ error: 'Receipt number already exists' });
            }
        }

        // 2. Verify Machine - BEFORE transaction
        const machine = await db.warehouseMachine.findFirst({
            where: { 
                serialNumber,
                branchId
            }
        });
        if (!machine) {
            return res.status(404).json({ error: 'Machine not found' });
        }
        if (req.user.branchId && machine.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to machine' });
        }
        if (machine.status === 'SOLD') {
            return res.status(400).json({ error: 'Machine is already sold' });
        }

        // 2.1 Ensure machine is not already assigned to any customer (posMachine)
        await ensureSerialNotAssignedToCustomer(serialNumber);

        // Fetch Customer - BEFORE transaction
        // Ensure customerId is also valid
        const customerBkcode = String(customerId).trim();
        if (!customerBkcode) {
            return res.status(400).json({ error: 'Customer ID required' });
        }
        
        const customer = await db.customer.findFirst({
            where: {
                bkcode: customerBkcode,
                branchId
            }
        });

        if (!customer) {
            return res.status(404).json({ error: 'Customer not found' });
        }
        if (req.user.branchId && customer.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to customer' });
        }

        // ALL WRITE OPERATIONS IN TRANSACTION
        const result = await db.$transaction(async (tx) => {
            // 3. Create Sale Record (using roundMoney to prevent floating point errors)
            const roundedTotalPrice = roundMoney(totalPrice);
            const roundedPaidAmount = roundMoney(paidAmount);

            const sale = await tx.machineSale.create({
                data: {
                    branchId,
                    serialNumber,
                    customerId,
                    type,
                    totalPrice: roundedTotalPrice,
                    paidAmount: roundedPaidAmount,
                    status: type === 'CASH' ? 'COMPLETED' : 'ONGOING',
                    notes
                }
            });

            // 4. Generate Installments if needed
            let createdInstallments = [];
            if (type === 'INSTALLMENT' && installmentCount > 0) {
                const totalRemaining = roundMoney(roundedTotalPrice - roundedPaidAmount);
                const monthlyAmount = roundMoney(totalRemaining / installmentCount);
                const today = new Date();

                let sumOfInstallments = 0;

                for (let i = 1; i <= installmentCount; i++) {
                    const dueDate = new Date(today);
                    dueDate.setMonth(dueDate.getMonth() + i);

                    // For the last installment, adjust to match exactly the remaining balance
                    let amountToCharge = monthlyAmount;
                    if (i === installmentCount) {
                        amountToCharge = roundMoney(totalRemaining - sumOfInstallments);
                    }

                    const inst = await tx.installment.create({
                        data: {
                            saleId: sale.id,
                            branchId: branchId,
                            dueDate: dueDate,
                            amount: amountToCharge,
                            isPaid: false,
                            description: `القسط رقم ${i} من ${installmentCount}`
                        }
                    });
                    createdInstallments.push(inst);
                    sumOfInstallments = roundMoney(sumOfInstallments + amountToCharge);
                }
            }

            // 5. Update Warehouse Machine Status
            await tx.warehouseMachine.update({
                where: { id: machine.id },
                data: { status: 'SOLD' }
            });

            // 5.1 Create Customer PosMachine Record (Transfer Asset)
            await tx.posMachine.create({
                data: {
                    serialNumber: machine.serialNumber,
                    model: machine.model,
                    manufacturer: machine.manufacturer,
                    customerId: customerId,
                    branchId: branchId,
                    isMain: false // Default
                }
            });

            // 6. Log Movement
            await tx.machineMovementLog.create({
                data: {
                    machineId: machine.id,
                    serialNumber: machine.serialNumber,
                    action: 'SELL',
                    details: `Sold to customer ${customer.client_name} (${type})`,
                    performedBy
                }
            });

            // 7. Create Payment Record
            if (roundedPaidAmount > 0) {
                await tx.payment.create({
                    data: {
                        branchId: branchId,
                        customerId,
                        customerName: customer.client_name,
                        amount: roundedPaidAmount,
                        reason: `بيع ماكينة ${serialNumber}`,
                        paymentPlace: req.body.paymentMethod || 'ضامن',
                        receiptNumber: req.body.receiptNumber,
                        notes: `دفعة ${type === 'CASH' ? 'كاملة' : 'مقدم'} - ${notes || ''}`,
                        userId: req.user.id,
                        userName: req.user.displayName || performedBy,
                        createdAt: new Date()
                    }
                });
            }

            // Return Sale with Installments
            const fullSale = await tx.machineSale.findUnique({
                where: { id: sale.id },
                include: {
                    installments: true,
                    customer: true
                }
            });

            return fullSale;
        });

        res.json({
            ...result,
            model: machine.model,
            manufacturer: machine.manufacturer,
            paymentMethod: paymentPlace || paymentMethod || 'ضامن',
            receiptNumber: req.body.receiptNumber
        });
    } catch (error) {
        console.error('Sale creation failed:', error);

        // Friendly duplicate handling
        if (error.code === 'SERIAL_IN_USE') {
            return res.status(error.status || 400).json({
                error: error.message,
                conflict: error.conflict
            });
        }

        if (error.code === 'P2002') {
            const conflicts = await getSerialConflicts(req.body?.serialNumber);
            return res.status(400).json({
                error: 'الماكينة مسجلة مسبقاً ولا يمكن بيعها',
                serialNumber: req.body?.serialNumber,
                conflicts
            });
        }

        res.status(error.status || 500).json({ error: error.message || 'Sale creation failed' });
    }
});

// POST Pay Installment
router.post('/installments/:id/pay', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { amount, receiptNumber, paymentPlace } = req.body;

        // Validation
        if (!paymentPlace) {
            return res.status(400).json({ error: 'يجب اختيار مكان الدفع' });
        }
        if (!receiptNumber || receiptNumber.trim() === '') {
            return res.status(400).json({ error: 'يجب إدخال رقم الإيصال' });
        }

        // Validate receipt number is unique
        if (receiptNumber && receiptNumber.trim() !== '') {
            const existingPayment = await db.payment.findFirst({
                where: { receiptNumber: receiptNumber.trim() }
            });
            if (existingPayment) {
                return res.status(400).json({ error: 'رقم الإيصال مستخدم من قبل' });
            }

            const existingInstallment = await db.installment.findFirst({
                where: {
                    receiptNumber: receiptNumber.trim(),
                    isPaid: true
                }
            });
            if (existingInstallment) {
                return res.status(400).json({ error: 'رقم الإيصال مستخدم من قبل' });
            }
        }

        // Get installment details first
        const existing = await db.installment.findUnique({
            where: { id },
            include: { sale: { include: { customer: true } } }
        });

        if (!existing) return res.status(404).json({ error: 'Installment not found' });

        // Skip branch check - MachineSale doesn't have branchId

        // ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
        const result = await db.$transaction(async (tx) => {
            // 1. Update installment to paid
            const installment = await tx.installment.update({
                where: { id },
                data: {
                    isPaid: true,
                    paidAt: new Date(),
                    paidAmount: amount || existing.amount,
                    receiptNumber: receiptNumber || null,
                    paymentPlace: paymentPlace || null
                }
            });

            // 2. Update sale paidAmount
            await tx.machineSale.update({
                where: { id: existing.saleId },
                data: {
                    paidAmount: {
                        increment: amount || existing.amount
                    }
                }
            });

            // 3. Create payment record
            let payment = null;
            if (existing.sale?.customer) {
                payment = await tx.payment.create({
                    data: {
                        branchId: existing.branchId || existing.sale.branchId || req.user.branchId,
                        customerId: existing.sale.customerId,
                        customerName: existing.sale.customer.client_name,
                        amount: amount || existing.amount,
                        type: 'INSTALLMENT',
                        reason: existing.description || 'سداد قسط',
                        paymentPlace: paymentPlace || null,
                        receiptNumber: receiptNumber || '',
                        notes: `سداد ${existing.description}`,
                        userId: req.user.id,
                        userName: req.user.displayName
                    }
                });
            }

            return { installment, payment };
        });

        // Log successful payment (AFTER transaction)
        await logAction({
            entityType: 'INSTALLMENT',
            entityId: id,
            action: 'PAY',
            details: `دفع قسط بمبلغ ${amount || existing.amount} - إيصال ${receiptNumber}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: existing.branchId || existing.sale.branchId || req.user.branchId
        });

        res.json(result.installment);
    } catch (error) {
        console.error('Payment failed:', error);
        res.status(500).json({ error: 'Payment failed' });
    }
});

// PUT Recalculate Installments
router.put('/:saleId/recalculate', authenticateToken, async (req, res) => {
    try {
        const { saleId } = req.params;
        const { newCount } = req.body;

        const sale = await db.machineSale.findUnique({
            where: { id: saleId },
            include: { installments: true }
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        if (req.user.branchId && sale.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // Calculate remaining amount (total - what's already paid including downpayment)
        // sale.paidAmount already includes the downpayment + any paid installments
        const totalRemaining = roundMoney(sale.totalPrice - sale.paidAmount);

        if (totalRemaining <= 0) {
            return res.status(400).json({ error: 'No remaining balance to recalculate' });
        }

        // ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
        const newInstallments = await db.$transaction(async (tx) => {
            // 1. Delete unpaid installments
            await tx.installment.deleteMany({
                where: {
                    saleId,
                    isPaid: false
                }
            });

            // 2. Create new installments
            const installmentAmount = roundMoney(totalRemaining / newCount);
            const today = new Date();
            const installments = [];
            let sumOfNew = 0;

            for (let i = 1; i <= newCount; i++) {
                const dueDate = new Date(today);
                dueDate.setMonth(dueDate.getMonth() + i);

                // Handle remainder in the last installment
                let amountToCharge = installmentAmount;
                if (i === newCount) {
                    amountToCharge = roundMoney(totalRemaining - sumOfNew);
                }

                const inst = await tx.installment.create({
                    data: {
                        saleId,
                        branchId: req.user.branchId || sale.branchId,
                        amount: amountToCharge,
                        dueDate,
                        description: `القسط رقم ${i} من ${newCount}`
                    }
                });
                installments.push(inst);
                sumOfNew = roundMoney(sumOfNew + amountToCharge);
            }

            return installments;
        });

        // Log successful recalculation (AFTER transaction)
        await logAction({
            entityType: 'SALE',
            entityId: saleId,
            action: 'RECALCULATE_INSTALLMENTS',
            details: `إعادة حساب الأقساط - المتبقي: ${totalRemaining} - عدد الأقساط الجديدة: ${newCount}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: req.user.branchId || sale.branchId
        });

        res.json({ success: true, newInstallments });
    } catch (error) {
        console.error('Recalculate failed:', error);
        res.status(500).json({ error: 'Recalculate failed' });
    }
});

// DELETE Sale (Void Transaction)
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;

        // Find the sale first
        const sale = await db.machineSale.findUnique({
            where: { id },
            include: { installments: true }
        });

        if (!sale) return res.status(404).json({ error: 'Sale not found' });
        if (req.user.branchId && sale.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        await db.$transaction(async (tx) => {
            // 1. Delete Installments
            await tx.installment.deleteMany({
                where: { saleId: id }
            });

            // 2. Delete PosMachine
            const posMachine = await tx.posMachine.findUnique({
                where: { serialNumber: sale.serialNumber }
            });

            if (posMachine && posMachine.customerId === sale.customerId) {
                await tx.posMachine.delete({
                    where: { id: posMachine.id }
                });
            }

            // 3. Update WarehouseMachine Status back to NEW (or whatever appropriate)
            const warehouseMachine = await tx.warehouseMachine.findUnique({
                where: { serialNumber: sale.serialNumber }
            });

            if (warehouseMachine) {
                await tx.warehouseMachine.update({
                    where: { id: warehouseMachine.id },
                    data: { status: 'NEW' } // Defaulting to NEW, could be STANDBY if previously was.
                });
            }

            // 4. Delete Sale Record
            await tx.machineSale.delete({
                where: { id }
            });

            // 5. Log Void
            if (warehouseMachine) {
                await tx.machineMovementLog.create({
                    data: {
                        machineId: warehouseMachine.id,
                        serialNumber: warehouseMachine.serialNumber,
                        action: 'SALE_VOID',
                        details: `Sale ${id} voided for customer ${sale.customerId}`,
                        performedBy: req.user?.displayName || 'Admin'
                    }
                });
            }
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Delete sale failed:', error);
        res.status(500).json({ error: 'Delete failed' });
    }
});

module.exports = router;
