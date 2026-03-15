const db = require('../db');
const { detectMachineParams } = require('../utils/machine-validation');
const inventoryService = require('./inventoryService');
const paymentService = require('./paymentService');
const socketManager = require('../utils/socketManager');
const { getBranchScope, userHasGlobalRole } = require('../utils/branchSecurity');
const { REQUEST_STATUS, MACHINE_STATUS } = require('../utils/constants');

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
        let machine = null;
        if (data.posMachineId) {
            machine = await tx.posMachine.findFirst({
                where: { id: data.posMachineId, branchId: user.branchId || data.branchId }
            });

            if (!machine) {
                throw new Error('الماكينة غير موجودة');
            }
        }

        // Resolve machine model/manufacturer if missing
        let resolvedModel = data.machineModel || machine?.model;
        let resolvedManufacturer = data.machineManufacturer || machine?.manufacturer;

        if (!resolvedModel && (data.serialNumber || machine?.serialNumber)) {
            const machineParams = await tx.machineParameter.findMany();
            const detected = detectMachineParams(data.serialNumber || machine?.serialNumber, machineParams);
            resolvedModel = detected.model;
            resolvedManufacturer = detected.manufacturer;
        }

        // Create request
        const request = await tx.maintenanceRequest.create({
            data: {
                customerId: customer.id, // Use actual customer cuid
                posMachineId: data.posMachineId || null,
                customerName: customer.client_name,
                customerBkcode: customer.bkcode,
                machineModel: resolvedModel,
                machineManufacturer: resolvedManufacturer,
                serialNumber: data.serialNumber || machine?.serialNumber,
                complaint: data.complaint,
                status: REQUEST_STATUS.PENDING,
                branchId: user.branchId || data.branchId
            },
            include: {
                customer: true,
                posMachine: true
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
            const m = await tx.posMachine.findFirst({
                where: { id: data.posMachineId, branchId: request.branchId }
            });
            if (m) {
                await receiveMachineToWarehouse(tx, {
                    serialNumber: m.serialNumber,
                    customerId: customer.id, // Use actual customer cuid
                    customerName: customer.client_name,
                    customerBkcode: customer.bkcode,
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
        const request = await tx.maintenanceRequest.findFirst({
            where: {
                id: requestId,
                ...getBranchScope(user)
            },
            include: { customer: true }
        });


        if (!request) {
            throw new Error('طلب الصيانة غير موجود');
        }

        if (request.status === REQUEST_STATUS.CLOSED) {
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
                status: REQUEST_STATUS.CLOSED,
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

        const updatedRequest = await tx.maintenanceRequest.findFirst({
            where: { id: requestId, branchId: request.branchId },
            include: { customer: true }
        });

        // 4. Deduct inventory (VALIDATES inside)
        // If fails → ROLLBACK entire transaction
        if (usedParts.length > 0) {
            await inventoryService.deductParts(
                usedParts,
                requestId,
                user.name,
                request.branchId, // Pass branchId
                receiptNumber, // Pass receiptNumber
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

        // 5.6 Create UsedPartLog for Technician Consumption Reports
        if (partsWithCosts.length > 0) {
            await tx.usedPartLog.create({
                data: {
                    requestId: requestId,
                    customerId: request.customerId,
                    customerName: request.customer.client_name,
                    customerBkcode: request.customerBkcode || request.customer?.bkcode,
                    posMachineId: request.posMachineId,
                    technician: request.technician || request.closingUserName, // Use assigned technician if available
                    closedByUserId: user.id,
                    closedAt: new Date(),
                    parts: JSON.stringify(partsWithCosts),
                    receiptNumber: receiptNumber,
                    branchId: request.branchId
                }
            });
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
        const request = await tx.maintenanceRequest.findFirst({
            where: {
                id: requestId,
                ...getBranchScope(user)
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
async function receiveMachineToWarehouse(tx, { serialNumber, customerId, customerName, customerBkcode, requestId, branchId, performedBy }) {
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
                status: MACHINE_STATUS.UNDER_MAINTENANCE,
                customerId,
                customerName,
                customerBkcode,
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
                status: MACHINE_STATUS.UNDER_MAINTENANCE,
                customerId,
                customerName,
                customerBkcode,
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

/**
 * Get paginated requests with filters
 * @param {Object} filters - Query filters
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} Requests and total count
 */
async function getRequests(filters = {}, user) {
    const {
        status,
        serialNumber,
        customerId,
        branchId: filterBranchId,
        includeRelations = false,
        limit = 50,
        offset = 0,
        search
    } = filters;

    const where = {
        ...getBranchScope(user)
    };

    if (status) where.status = status;
    if (serialNumber) where.serialNumber = { contains: serialNumber };
    if (customerId) where.customerId = customerId;
    if (filterBranchId && userHasGlobalRole(user)) {
        where.branchId = filterBranchId;
    }

    const include = includeRelations ? {
        customer: true,
        posMachine: true,
        branch: { select: { id: true, name: true } }
    } : undefined;

    let requests;
    let total;

    if (search && includeRelations) {
        // Search in customer names, serial numbers, and complaints
        requests = await db.maintenanceRequest.findMany({
            where: {
                ...where,
                OR: [
                    { customerName: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { complaint: { contains: search, mode: 'insensitive' } }
                ]
            },
            include,
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        });
        total = await db.maintenanceRequest.count({
            where: {
                ...where,
                OR: [
                    { customerName: { contains: search, mode: 'insensitive' } },
                    { serialNumber: { contains: search, mode: 'insensitive' } },
                    { complaint: { contains: search, mode: 'insensitive' } }
                ]
            }
        });
    } else {
        // Normal query without search
        const result = await Promise.all([
            db.maintenanceRequest.findMany({
                where,
                include,
                orderBy: { createdAt: 'desc' },
                take: limit,
                skip: offset
            }),
            db.maintenanceRequest.count({ where })
        ]);
        requests = result[0];
        total = result[1];
    }

    return { requests, total };
}

/**
 * Get single request by ID
 * @param {String} requestId - Request ID
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} Request details
 */
async function getRequestById(requestId, user) {
    const request = await db.maintenanceRequest.findFirst({
        where: {
            id: requestId,
            ...getBranchScope(user)
        },
        include: {
            customer: true,
            posMachine: true,
            branch: { select: { id: true, name: true } },
            approval: true,
            vouchers: true,
            payments: true
        }
    });

    if (!request) {
        throw new Error('الطلب غير موجود');
    }

    return request;
}

/**
 * Get request statistics with day/week/month breakdown
 * @param {Object} user - Authenticated user
 * @returns {Promise<Object>} Statistics by time period
 */
async function getRequestStats(user) {
    const where = getBranchScope(user);
    const now = new Date();

    // Calculate date ranges
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Helper function to get stats for a date range
    async function getStatsForRange(startDate, endDate) {
        const rangeWhere = {
            ...where,
            createdAt: {
                gte: startDate,
                lte: endDate
            }
        };

        const [open, inProgress, closed, total] = await Promise.all([
            db.maintenanceRequest.count({
                where: { ...rangeWhere, status: { in: ['Pending', 'Open'] } }
            }),
            db.maintenanceRequest.count({
                where: { ...rangeWhere, status: 'In Progress' }
            }),
            db.maintenanceRequest.count({
                where: { ...rangeWhere, status: 'Closed' }
            }),
            db.maintenanceRequest.count({ where: rangeWhere })
        ]);

        return { open, inProgress, closed, total };
    }

    // Get stats for each period
    const [day, week, month] = await Promise.all([
        getStatsForRange(today, now),
        getStatsForRange(weekStart, now),
        getStatsForRange(monthStart, now)
    ]);

    return { day, week, month };
}

/**
 * Update maintenance request
 * @param {String} requestId - Request ID
 * @param {Object} data - Update data
 * @param {Object} user - User performing update
 * @returns {Promise<Object>} Updated request
 */
async function updateRequest(requestId, data, user) {
    return await db.$transaction(async (tx) => {
        const request = await tx.maintenanceRequest.findFirst({
            where: {
                id: requestId,
                ...getBranchScope(user)
            }
        });

        if (!request) throw new Error('الطلب غير موجود');

        // Only allow updating certain fields
        const updateData = {};
        if (data.status) updateData.status = data.status;
        if (data.priority) updateData.priority = data.priority;
        if (data.complaint) updateData.complaint = data.complaint;
        if (data.notes) updateData.notes = data.notes;
        if (data.technicianId) {
            const technician = await tx.user.findFirst({
                where: { id: data.technicianId }
            });
            if (technician) {
                updateData.technicianId = technician.id;
                updateData.technician = technician.displayName || technician.name;
            }
        }

        const updated = await tx.maintenanceRequest.update({
            where: { id: requestId },
            data: updateData
        });

        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: requestId,
                action: 'UPDATE',
                details: `Updated request: ${Object.keys(updateData).join(', ')}`,
                userId: user.id,
                performedBy: user.name,
                branchId: request.branchId
            }
        });

        return updated;
    });
}

/**
 * Update request status (wrapper for updateStatus)
 */
async function updateRequestStatus(requestId, data, user) {
    return await updateStatus(requestId, data.status, user);
}

/**
 * Assign technician to request
 */
async function assignTechnician(requestId, technicianId, user) {
    return await updateRequest(requestId, { technicianId, status: 'In Progress' }, user);
}

/**
 * Delete maintenance request
 * @param {String} requestId - Request ID
 * @param {Object} user - User performing deletion
 * @returns {Promise<Object>} Deleted request info
 */
async function deleteRequest(requestId, user) {
    return await db.$transaction(async (tx) => {
        // 1. Get request with dependencies - MUST filter by branch for isolation
        const authorizedIds = user.authorizedBranchIds || (user.branchId ? [user.branchId] : []);

        const request = await tx.maintenanceRequest.findFirst({
            where: {
                id: requestId,
                ...getBranchScope(user)
            },
            include: {
                approval: true,
                vouchers: true
            }
        });

        if (!request) {
            throw new Error('الطلب غير موجود');
        }

        // 2. Permission check - only admin or the creating branch
        const isCreator = authorizedIds.includes(request.branchId);
        const isAdmin = userHasGlobalRole(user);

        if (!isAdmin && !isCreator) {
            throw new Error('غير مصرح لك بحذف هذا الطلب');
        }

        // 3. Status check - only allow deleting Open/Pending/In Progress requests
        // If it's closed, it has history, payments, etc.
        if (request.status === REQUEST_STATUS.CLOSED && !isAdmin) {
            throw new Error('لا يمكن حذف الطلبات المغلقة');
        }

        // 4. Financial safety check - prevent deletion if payments exist
        const payment = await tx.payment.findFirst({
            where: {
                requestId: requestId,
                branchId: request.branchId // Isolation requirement
            }
        });
        if (payment && !isAdmin) {
            throw new Error('لا يمكن حذف الطلب لوجود مدفوعات مسجلة عليه. يرجى حذف المدفوعات أولاً.');
        }

        // 5. Handle related records
        // Delete approval requests
        if (request.approval) {
            await tx.maintenanceApproval.deleteMany({
                where: {
                    requestId,
                    branchId: request.branchId // Isolation requirement
                }
            });
        }

        // Delete vouchers
        if (request.vouchers && request.vouchers.length > 0) {
            await tx.repairVoucher.deleteMany({
                where: {
                    requestId,
                    branchId: request.branchId // Isolation requirement
                }
            });
        }

        // 6. Delete the request
        await tx.maintenanceRequest.deleteMany({
            where: {
                id: requestId,
                branchId: request.branchId // Isolation requirement
            }
        });

        // 7. Log deletion
        await tx.systemLog.create({
            data: {
                entityType: 'REQUEST',
                entityId: requestId,
                action: 'DELETE',
                details: `Deleted request for customer ${request.customerName} (Serial: ${request.serialNumber})`,
                userId: user.id,
                performedBy: user.name || user.displayName,
                branchId: request.branchId
            }
        });

        return request;
    });
}

module.exports = {
    createRequest,
    getRequests,
    getRequestById,
    getRequestStats,
    updateRequest,
    updateRequestStatus,
    assignTechnician,
    closeRequest,
    updateStatus,
    deleteRequest,
    receiveMachineToWarehouse,
    getMachineMonthlyRequestCount
};
