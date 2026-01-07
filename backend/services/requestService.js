const db = require('../db');
const inventoryService = require('./inventoryService');
const paymentService = require('./paymentService');

/**
 * Create new maintenance request
 * @param {Object} data - Request data
 * @param {Object} user - User creating request
 * @returns {Promise<Object>} Created request
 */
async function createRequest(data, user) {
    return await db.$transaction(async (tx) => {
        // Validate customer
        const customer = await tx.customer.findUnique({
            where: { bkcode: data.customerId }
        });

        if (!customer) {
            throw new Error('العميل غير موجود');
        }

        // Validate machine if provided
        if (data.posMachineId) {
            const machine = await tx.posMachine.findUnique({
                where: { id: data.posMachineId }
            });

            if (!machine) {
                throw new Error('الماكينة غير موجودة');
            }
        }

        // Create request
        const request = await tx.maintenanceRequest.create({
            data: {
                customerId: data.customerId,
                posMachineId: data.posMachineId || null,
                customerName: customer.client_name,
                machineModel: data.machineModel,
                machineManufacturer: data.machineManufacturer,
                serialNumber: data.serialNumber,
                complaint: data.complaint,
                status: 'Pending',
                branchId: user.branchId || data.branchId
            }
        });

        // Log action
        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: request.id,
                action: 'CREATE',
                details: `Created request for customer ${customer.client_name}`,
                userId: user.id,
                performedBy: user.name,
                branchId: request.branchId
            }
        });

        return request;
    });
}

/**
 * Close maintenance request with FULL TRANSACTION
 * Either ALL succeeds or ALL fails (rollback)
 * @param {String} requestId - Request ID
 * @param {String} actionTaken - Action description
 * @param {Array} usedParts - Array of parts with {partId, name, quantity, cost, isPaid, reason}
 * @param {Object} user - User closing request
 * @returns {Promise<Object>} Updated request
 */
async function closeRequest(requestId, actionTaken, usedParts, user, receiptNumber = null) {
    return await db.$transaction(async (tx) => {
        // 1. Get request with customer
        const request = await tx.maintenanceRequest.findUnique({
            where: { id: requestId },
            include: { customer: true }
        });
        console.log('DEBUG: closeRequest fetched:', request);

        if (!request) {
            throw new Error('طلب الصيانة غير موجود');
        }

        if (request.status === 'Closed') {
            throw new Error('الطلب مغلق بالفعل');
        }

        // 2. Calculate costs
        const partsWithCosts = usedParts.map(p => ({
            ...p,
            totalCost: p.isPaid ? parseFloat(p.cost) * p.quantity : 0
        }));

        const totalCost = partsWithCosts
            .reduce((sum, p) => sum + p.totalCost, 0);

        // 3. Update request
        const updatedRequest = await tx.maintenanceRequest.update({
            where: { id: requestId },
            data: {
                status: 'Closed',
                actionTaken: actionTaken,
                usedParts: JSON.stringify({
                    parts: partsWithCosts,
                    totalCost: totalCost
                }),
                closingTimestamp: new Date(),
                receiptNumber: receiptNumber,
                closingUserId: user.id,
                closingUserName: user.name
            }
        });

        // 4. Deduct inventory (VALIDATES inside)
        // If fails → ROLLBACK entire transaction
        if (usedParts.length > 0) {
            await inventoryService.deductParts(
                usedParts,
                requestId,
                user.name,
                request.branchId, // Pass branchId
                tx // Pass transaction
            );
        }

        // 5. Create payment (if needed)
        const paidParts = partsWithCosts.filter(p => p.isPaid && p.cost > 0);
        if (paidParts.length > 0 && request.customerId) {
            await paymentService.createMaintenancePayment(
                paidParts,
                requestId,
                {
                    id: request.customerId,
                    name: request.customer.client_name
                },
                user,
                receiptNumber, // Pass receipt number
                tx, // Pass transaction
                request.branchId // Pass branchId
            );
        }

        // 5.5 Create Repair Vouchers (Paid & Free)
        const paidVoucherParts = partsWithCosts.filter(p => p.isPaid);
        const freeVoucherParts = partsWithCosts.filter(p => !p.isPaid);

        const vouchers = [];

        if (paidVoucherParts.length > 0) {
            const voucherCode = `VP-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const voucher = await tx.repairVoucher.create({
                data: {
                    code: voucherCode,
                    requestId: requestId,
                    type: 'PAID',
                    parts: JSON.stringify(paidVoucherParts),
                    totalCost: paidVoucherParts.reduce((s, p) => s + p.totalCost, 0),
                    branchId: request.branchId,
                    createdBy: user.name
                }
            });
            vouchers.push(voucher);
        }

        if (freeVoucherParts.length > 0) {
            const voucherCode = `VF-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;
            const voucher = await tx.repairVoucher.create({
                data: {
                    code: voucherCode,
                    requestId: requestId,
                    type: 'FREE',
                    parts: JSON.stringify(freeVoucherParts),
                    totalCost: 0, // Free
                    branchId: request.branchId,
                    createdBy: user.name
                }
            });
            vouchers.push(voucher);
        }

        // 6. Log action
        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: requestId,
                action: 'CLOSE',
                details: `Closed with ${usedParts.length} parts. Total: ${totalCost} ج.م`,
                userId: user.id,
                performedBy: user.name,
                branchId: request.branchId
            }
        });

        return { ...updatedRequest, vouchers };
    });
    // If ANY step fails → Everything rolls back! ✅
}

/**
 * Update request status
 * @param {String} requestId - Request ID
 * @param {String} status - New status
 * @param {Object} user - User updating status
 * @returns {Promise<Object>} Updated request
 */
async function updateStatus(requestId, status, user) {
    return await db.$transaction(async (tx) => {
        const request = await tx.maintenanceRequest.update({
            where: { id: requestId },
            data: { status }
        });

        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: requestId,
                action: 'UPDATE',
                details: `Status changed to ${status}`,
                userId: user.id,
                performedBy: user.name,
                branchId: request.branchId
            }
        });

        return request;
    });
}

/**
 * Handle machine receipt from customer to branch warehouse
 * @param {Object} tx - Prisma transaction
 * @param {Object} data - Machine and customer info
 */
async function receiveMachineToWarehouse(tx, { serialNumber, customerId, customerName, requestId, branchId, performedBy }) {
    // 1. Find if machine exists in warehouse already
    const existingWarehouse = await tx.warehouseMachine.findUnique({
        where: { serialNumber }
    });

    // 2. Find machine details from PosMachine if not in warehouse
    const posMachine = await tx.posMachine.findUnique({
        where: { serialNumber }
    });

    if (existingWarehouse) {
        await tx.warehouseMachine.update({
            where: { id: existingWarehouse.id },
            data: {
                status: 'EXTERNAL_REPAIR',
                customerId,
                customerName,
                requestId,
                branchId,
                model: posMachine?.model || existingWarehouse.model,
                manufacturer: posMachine?.manufacturer || existingWarehouse.manufacturer
            }
        });
    } else {
        await tx.warehouseMachine.create({
            data: {
                serialNumber,
                status: 'EXTERNAL_REPAIR',
                customerId,
                customerName,
                requestId,
                branchId,
                model: posMachine?.model || 'Unknown',
                manufacturer: posMachine?.manufacturer || 'Unknown'
            }
        });
    }

    // 3. Log movement
    const movementService = require('./movementService');
    await movementService.logMachineMovement(tx, {
        serialNumber,
        action: 'CLIENT_RECEIVED',
        details: `Received from customer ${customerName} for repair (Request ${requestId})`,
        performedBy,
        branchId,
        customerId
    });
}

module.exports = {
    createRequest,
    closeRequest,
    updateStatus,
    receiveMachineToWarehouse
};
