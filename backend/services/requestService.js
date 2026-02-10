const db = require('../db');
const inventoryService = require('./inventoryService');
const paymentService = require('./paymentService');
const socketManager = require('../utils/socketManager');

/**
 * Create new maintenance request
 * @param {Object} data - Request data
 * @param {Object} user - User creating request
 * @returns {Promise<Object>} Created request
 */
async function createRequest(data, user) {
    return await db.$transaction(async (tx) => {
        // Validate customer - RULE 1: MUST include branchId
        const customer = await tx.customer.findFirst({
            where: { bkcode: data.customerId, branchId: user.branchId || data.branchId }
        });

        if (!customer) {
            throw new Error('العميل غير موجود');
        }

        // Validate machine if provided - RULE 1: MUST include branchId
        if (data.posMachineId) {
            const machine = await tx.posMachine.findFirst({
                where: { id: data.posMachineId, branchId: user.branchId || data.branchId }
            });

            if (!machine) {
                throw new Error('الماكينة غير موجودة');
            }
        }

        // Create request
        const request = await tx.maintenanceRequest.create({
            data: {
                customerId: customer.id, // Use actual customer cuid
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

        // Real-time notification: New Request Created
        socketManager.emitToBranch(request.branchId, 'request-created', {
            id: request.id,
            customerName: customer.client_name,
            serialNumber: request.serialNumber,
            timestamp: new Date()
        });

        // Global notification for Admins
        socketManager.emitToRole('SUPER_ADMIN', 'admin-alert', {
            type: 'NEW_REQUEST',
            message: `طلب صيانة جديد من فرع ${request.branchId}: ${customer.client_name}`,
            requestId: request.id
        });

        // If taking machine to warehouse
        if (data.takeMachine && data.posMachineId) {
            const machine = await tx.posMachine.findFirst({
                where: { id: data.posMachineId, branchId: request.branchId }
            });
            if (machine) {
                await receiveMachineToWarehouse(tx, {
                    serialNumber: machine.serialNumber,
                    customerId: customer.id, // Use actual customer cuid
                    customerName: customer.client_name,
                    requestId: request.id,
                    branchId: request.branchId,
                    performedBy: user.name || user.displayName
                });
            }
        }

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
        // 1. Get request with customer - RULE 1: MUST check authorization
        const authorizedIds = user.authorizedBranchIds || (user.branchId ? [user.branchId] : []);
        const request = await tx.maintenanceRequest.findFirst({
            where: {
                id: requestId,
                branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds }
            },
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

        // 3. Update request - RULE 1
        await tx.maintenanceRequest.updateMany({
            where: { id: requestId, branchId: request.branchId },
            data: {
                status: 'Closed',
                actionTaken: actionTaken,
                usedParts: JSON.stringify({
                    parts: partsWithCosts,
                    totalCost: totalCost
                }),
                totalCost: totalCost, // Ensure column is updated too
                closingTimestamp: new Date(),
                receiptNumber: receiptNumber,
                closingUserId: user.id,
                closingUserName: user.name || user.displayName
            }
        });

        const updatedRequest = await tx.maintenanceRequest.findFirst({ where: { id: requestId, branchId: request.branchId } });

        // 4. Deduct inventory (VALIDATES inside)
        // If fails â†’ ROLLBACK entire transaction
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
                details: `Closed with ${usedParts.length} parts. Total: ${totalCost} ج.م. Receipt: ${receiptNumber || 'N/A'}`,
                userId: user.id,
                performedBy: user.name || user.displayName,
                branchId: request.branchId
            }
        });

        // Real-time notification: Request Closed
        socketManager.emitToBranch(request.branchId, 'request-closed', {
            id: requestId,
            customerName: request.customer.client_name,
            totalCost: totalCost,
            receiptNumber: receiptNumber
        });

        return { ...updatedRequest, vouchers };
    });
    // If ANY step fails â†’ Everything rolls back! âœ…
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
        const authorizedIds = user.authorizedBranchIds || (user.branchId ? [user.branchId] : []);
        const request = await tx.maintenanceRequest.findFirst({
            where: {
                id: requestId,
                branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds }
            }
        });

        if (!request) throw new Error('Request not found or access denied');

        await tx.maintenanceRequest.updateMany({
            where: { id: requestId, branchId: request.branchId }, // Use request's actual branch
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
    // 1. Find if machine exists in warehouse - RULE 1: MUST include branchId
    const existingWarehouse = await tx.warehouseMachine.findFirst({
        where: { serialNumber, branchId }
    });

    // 2. Find machine details from PosMachine - RULE 1: MUST include branchId
    const posMachine = await tx.posMachine.findFirst({
        where: { serialNumber, branchId }
    });

    if (existingWarehouse) {
        await tx.warehouseMachine.updateMany({
            where: { id: existingWarehouse.id, branchId: branchId },
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
    });
}

/**
 * Get machine monthly request count
 */
async function getMachineMonthlyRequestCount(serialNumber, months = 6) {
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth() - months, 1);

    const requests = await db.maintenanceRequest.findMany({
        where: {
            serialNumber,
            // RULE 1: Every query MUST include branchId filter
            // Note: For global tracking, we might need a specific branch context
            branchId: { not: null },
            createdAt: { gte: startDate }
        },
        orderBy: { createdAt: 'asc' }
    });

    // Simple count
    const count = requests.length;

    // Build trend
    const trend = [];
    for (let i = 0; i <= months; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthYear = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const monthCount = requests.filter(r =>
            r.createdAt.getFullYear() === d.getFullYear() &&
            r.createdAt.getMonth() === d.getMonth()
        ).length;
        trend.unshift({ month: monthYear, count: monthCount });
    }

    return { count, trend };
}

module.exports = {
    createRequest,
    closeRequest,
    updateStatus,
    receiveMachineToWarehouse,
    getMachineMonthlyRequestCount
};
