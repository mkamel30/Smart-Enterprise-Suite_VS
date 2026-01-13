const db = require('../db');
const { detectMachineParams } = require('../utils/machine-validation');
const { createNotification } = require('../routes/notifications');
const movementService = require('./movementService');
const ExcelJS = require('exceljs');
const { validateTransferOrder } = require('../utils/transfer-validators');

// Apply branch scoping for transfer-order queries (from/to branch)
function applyTransferBranchFilter(args = {}, user, branchId) {
    const isGlobalAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user?.role);
    const targetBranchId = isGlobalAdmin ? (branchId || undefined) : user?.branchId;

    // Ensure where exists
    if (!args.where) args.where = {};

    // If we have a target branch, filter by it (either as from or to)
    if (targetBranchId) {
        args.where = {
            ...args.where,
            OR: [{ fromBranchId: targetBranchId }, { toBranchId: targetBranchId }]
        };
    }

    // Every query MUST include branchId filter - RULE 1
    if (isGlobalAdmin) {
        if (!args.where.branchId) {
            args.where.branchId = { not: null };
        }
    }

    return args;
}

async function generateOrderNumber() {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await db.transferOrder.findFirst({
        where: {
            orderNumber: { startsWith: `TO-${dateStr}` },
            branchId: { not: null } // RULE 1
        },
        orderBy: { orderNumber: 'desc' }
    });

    let seq = 1;
    if (lastOrder) {
        const parts = lastOrder.orderNumber.split('-');
        seq = parseInt(parts[2] || '0') + 1;
    }

    return `TO-${dateStr}-${seq.toString().padStart(3, '0')}`;
}

async function createTransferOrder({ fromBranchId, toBranchId, type, items, notes, createdBy, createdByName }, user) {
    // Support fallback from incoming payload where destination may be in branchId
    const destinationBranchId = toBranchId || (arguments[0] && arguments[0].branchId) || null;
    const sourceBranchId = fromBranchId || user.branchId;

    // ============= COMPREHENSIVE VALIDATION =============
    const validationData = {
        fromBranchId: sourceBranchId,
        toBranchId: destinationBranchId,
        type,
        items: items || []
    };

    const validation = await validateTransferOrder(validationData, user);

    if (!validation.valid) {
        const err = new Error(validation.errors.join('\n'));
        err.status = 400;
        throw err;
    }

    // Log warnings if any
    if (validation.warnings && validation.warnings.length > 0) {
        console.warn('âڑ ï¸ڈ Transfer Order Warnings:', validation.warnings.join('\n'));
    }
    // ============= END VALIDATION =============

    const orderNumber = await generateOrderNumber();

    const machineParams = type === 'MACHINE' ? await db.machineParameter.findMany() : [];

    const processedItems = items.map(item => {
        let finalType = item.type;
        let finalModel = item.type;
        let manufacturer = item.manufacturer;

        if (type === 'MACHINE') {
            finalModel = item.type;
            if (!finalModel && item.serialNumber) {
                const detected = detectMachineParams ? detectMachineParams(item.serialNumber, machineParams) : {};
                if (detected.model) finalModel = detected.model;
                if (!manufacturer && detected.manufacturer) manufacturer = detected.manufacturer;
            }
            finalType = 'MACHINE';
        } else {
            finalModel = null;
        }

        return {
            serialNumber: item.serialNumber,
            type: finalType || item.type,
            model: finalModel || null,
            manufacturer: manufacturer || null,
            notes: item.notes || null,
            isReceived: false
        };
    });

    // Create order and perform associated updates inside a transaction for atomicity
    const order = await db.$transaction(async (tx) => {
        const created = await tx.transferOrder.create({
            data: {
                orderNumber,
                fromBranchId: sourceBranchId,
                toBranchId: destinationBranchId,
                branchId: destinationBranchId,
                type,
                createdBy: createdBy || user.displayName || user.name || 'system',
                createdByName: createdByName || user.displayName || user.name || 'النظام',
                createdByUserId: user.id,
                notes,
                items: { create: processedItems }
            },
            include: { fromBranch: true, toBranch: true, items: true }
        });

        // Get serial numbers for status updates
        const serialsToTransfer = processedItems.map(i => i.serialNumber).filter(s => s);

        // Update statuses within transaction - FREEZE items by setting IN_TRANSIT
        if (type === 'MACHINE' || type === 'MAINTENANCE') {
            await tx.warehouseMachine.updateMany({
                where: {
                    serialNumber: { in: serialsToTransfer },
                    branchId: sourceBranchId
                },
                data: { status: 'IN_TRANSIT' }
            });
        } else if (type === 'SIM') {
            await tx.warehouseSim.updateMany({
                where: {
                    serialNumber: { in: serialsToTransfer },
                    branchId: sourceBranchId
                },
                data: { status: 'IN_TRANSIT' }
            });
        }

        // Update maintenance requests if any
        if (serialsToTransfer.length > 0) {
            const activeRequests = await tx.maintenanceRequest.findMany({ where: { serialNumber: { in: serialsToTransfer }, status: { notIn: ['Closed', 'Cancelled'] }, branchId: sourceBranchId } });
            for (const r of activeRequests) {
                await tx.maintenanceRequest.updateMany({ where: { id: r.id, branchId: sourceBranchId }, data: { status: 'PENDING_TRANSFER' } });
            }
        }

        return created;
    });

    // Notification after successful transaction
    try {
        await createNotification({ branchId: destinationBranchId, type: 'TRANSFER_ORDER', title: 'إذن صرف جديد', message: `تم إرسال إذن صرف جديد رقم ${orderNumber} يحتوي على ${items.length} صنف`, data: { orderId: order.id, orderNumber }, link: `/receive-orders?orderId=${order.id}` });
    } catch (notifErr) {
        console.warn('Failed to create notification for transfer order', notifErr);
    }

    return order;
}

async function receiveTransferOrder(orderId, { receivedBy, receivedByName, receivedItems }, user) {
    const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
    let order;
    if (isAdmin) {
        order = await db.transferOrder.findFirst({ where: { id: orderId, branchId: { not: null } }, include: { items: true, fromBranch: true, toBranch: true } });
    } else {
        if (!user.branchId) {
            const err = new Error('Access denied'); err.status = 403; throw err;
        }
        order = await db.transferOrder.findFirst({
            where: {
                id: orderId,
                branchId: user.branchId,
                OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
            },
            include: { items: true, fromBranch: true, toBranch: true }
        });
    }

    if (!order) {
        const err = new Error('الإذن غير موجود');
        err.status = 404;
        throw err;
    }

    if (order.status !== 'PENDING') {
        const err = new Error('الإذن ليس في حالة انتظار');
        err.status = 400;
        throw err;
    }

    const itemsToReceive = receivedItems || order.items.map(i => i.id);
    const allReceived = itemsToReceive.length === order.items.length;

    await db.$transaction(async (tx) => {
        // Mark items as received
        for (const itemId of itemsToReceive) {
            await tx.transferOrderItem.update({ where: { id: itemId }, data: { isReceived: true, receivedAt: new Date() } });
        }

        // Update order status - RULE 1
        await tx.transferOrder.updateMany({
            where: {
                id: orderId,
                branchId: order.branchId || { not: null }
            },
            data: {
                status: allReceived ? 'RECEIVED' : 'PARTIAL',
                receivedBy,
                receivedByName,
                receivedAt: new Date()
            }
        });

        // Add items to warehouse based on type
        const receivedItemData = order.items.filter(i => itemsToReceive.includes(i.id));

        for (const item of receivedItemData) {
            if (order.type === 'SIM') {
                const existing = await tx.warehouseSim.findFirst({
                    where: { serialNumber: item.serialNumber, branchId: { not: null } }
                });
                let simObj;
                if (!existing) {
                    simObj = await tx.warehouseSim.create({ data: { branchId: order.branchId, serialNumber: item.serialNumber, type: item.type || 'أخرى', status: 'ACTIVE', notes: `تم الإضافة من إذن ${order.orderNumber}` } });
                } else {
                    await tx.warehouseSim.updateMany({ where: { id: existing.id, branchId: { not: null } }, data: { branchId: order.branchId, status: existing.status === 'IN_TRANSIT' ? 'ACTIVE' : existing.status } });
                    simObj = await tx.warehouseSim.findFirst({ where: { id: existing.id, branchId: { not: null } } });
                }

                await movementService.logSimMovement(tx, { simId: simObj.id, serialNumber: item.serialNumber, action: 'TRANSFER_IN', details: { reason: 'Transfer Order Received', orderNumber: order.orderNumber, fromBranchId: order.fromBranchId }, performedBy: receivedByName || 'System', branchId: order.branchId, fromBranchId: order.fromBranchId });
            } else if (['MACHINE', 'MAINTENANCE', 'SEND_TO_CENTER'].includes(order.type)) {
                const existing = await tx.warehouseMachine.findFirst({
                    where: { serialNumber: item.serialNumber, branchId: { not: null } }
                });

                let newStatus = 'NEW';
                if (['MAINTENANCE', 'SEND_TO_CENTER'].includes(order.type)) {
                    if (order.toBranch.type === 'MAINTENANCE_CENTER') {
                        newStatus = 'RECEIVED_AT_CENTER';
                        const activeRequest = await tx.maintenanceRequest.findFirst({ where: { serialNumber: item.serialNumber, status: { in: ['PENDING_TRANSFER', 'Open', 'In Progress'] }, branchId: order.fromBranchId } });
                        if (activeRequest) {
                            await tx.maintenanceRequest.updateMany({ where: { id: activeRequest.id, branchId: order.fromBranchId }, data: { status: 'Open', servicedByBranchId: order.toBranchId } });
                        }
                    } else {
                        newStatus = 'REPAIRED';
                    }
                } else if (existing) {
                    if (existing.status === 'IN_TRANSIT') newStatus = 'NEW'; else newStatus = existing.status;
                }

                if (!existing) {
                    await tx.warehouseMachine.create({ data: { branchId: order.branchId, serialNumber: item.serialNumber, model: item.type || 'Unknown', manufacturer: item.manufacturer || 'Unknown', status: newStatus, notes: `تم الإضافة من إذن ${order.orderNumber}` } });
                } else {
                    const updateData = { branchId: order.branchId, status: newStatus };
                    if (['MAINTENANCE', 'SEND_TO_CENTER'].includes(order.type) && order.toBranch.type === 'MAINTENANCE_CENTER') updateData.originBranchId = order.fromBranchId;
                    await tx.warehouseMachine.updateMany({
                        where: { id: existing.id, branchId: { not: null } },
                        data: updateData
                    });
                }

                await movementService.logMachineMovement(tx, { machineId: existing?.id || item.id, serialNumber: item.serialNumber, action: 'TRANSFER_IN', details: { reason: 'Transfer Order Received', orderNumber: order.orderNumber, fromBranchId: order.fromBranchId }, performedBy: receivedByName || 'System', branchId: order.branchId, fromBranchId: order.fromBranchId });
            }
        }
    });

    let updatedOrder;
    if (isAdmin) {
        updatedOrder = await db.transferOrder.findFirst({ where: { id: orderId, branchId: { not: null } }, include: { items: true, fromBranch: true, toBranch: true } });
    } else {
        updatedOrder = await db.transferOrder.findFirst({
            where: {
                id: orderId,
                branchId: user.branchId,
                OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
            },
            include: { items: true, fromBranch: true, toBranch: true }
        });
    }
    return updatedOrder;
}

async function createBulkTransfer({ serialNumbers, toBranchId, waybillNumber, notes, performedBy }, user) {
    const fromBranchId = user.branchId;
    if (!serialNumbers?.length || !toBranchId) {
        const err = new Error('Serial numbers and destination branch are required');
        err.status = 400;
        throw err;
    }

    // ============= VALIDATION =============
    const { validateItemsForTransfer, validateBranches } = require('../utils/transfer-validators');

    const branchValidation = await validateBranches(fromBranchId, toBranchId, 'MAINTENANCE');
    if (!branchValidation.valid) {
        const err = new Error(branchValidation.errors.join('\n'));
        err.status = 400;
        throw err;
    }

    const itemsValidation = await validateItemsForTransfer(serialNumbers, 'MACHINE', fromBranchId);
    if (!itemsValidation.valid) {
        const err = new Error(itemsValidation.errors.join('\n'));
        err.status = 400;
        throw err;
    }
    // ============= END VALIDATION =============

    const result = await db.$transaction(async (tx) => {
        const machines = await tx.warehouseMachine.findMany({
            where: { serialNumber: { in: serialNumbers }, branchId: fromBranchId },
            select: { id: true, serialNumber: true, model: true, manufacturer: true, requestId: true }
        });
        const machineMap = new Map(machines.map(m => [m.serialNumber, m]));

        const orderNumber = `TO-MT-${Date.now()}`;
        const order = await tx.transferOrder.create({
            data: {
                orderNumber,
                waybillNumber,
                fromBranchId,
                toBranchId,
                branchId: toBranchId,
                type: 'MAINTENANCE',
                notes,
                createdByUserId: user.id,
                createdByName: performedBy || user.displayName,
                items: {
                    create: serialNumbers.map(s => {
                        const machineInfo = machineMap.get(s) || {};
                        return { serialNumber: s, type: 'MACHINE', model: machineInfo.model || null, manufacturer: machineInfo.manufacturer || null };
                    })
                }
            }
        });

        // Update maintenance requests status to PENDING_TRANSFER and link to machines
        const activeRequests = await tx.maintenanceRequest.findMany({
            where: {
                serialNumber: { in: serialNumbers },
                status: { notIn: ['Closed', 'Cancelled'] },
                branchId: fromBranchId
            }
        });

        // Create map of serialNumber to requestId
        const requestMap = new Map(activeRequests.map(r => [r.serialNumber, r.id]));

        for (const req of activeRequests) {
            await tx.maintenanceRequest.updateMany({
                where: { id: req.id, branchId: fromBranchId },
                data: { status: 'PENDING_TRANSFER' }
            });
        }

        // Update machine status to IN_TRANSIT and link to request - RULE 1
        for (const serial of serialNumbers) {
            const machineInfo = machineMap.get(serial);
            const requestId = requestMap.get(serial);

            await tx.warehouseMachine.updateMany({
                where: { serialNumber: serial, branchId: fromBranchId },
                data: {
                    notes: `In Bulk Transfer ${orderNumber} (Waybill: ${waybillNumber})`,
                    status: 'IN_TRANSIT',
                    requestId: requestId || machineInfo?.requestId, // Keep existing requestId if no active request
                    originBranchId: fromBranchId
                }
            });
        }

        // Create movement logs for each machine
        for (const machine of machines) {
            await tx.machineMovementLog.create({
                data: {
                    machineId: machine.id,
                    serialNumber: machine.serialNumber,
                    action: 'BULK_TRANSFER_TO_MAINTENANCE',
                    details: `Bulk transfer to maintenance center - Order: ${orderNumber}, Waybill: ${waybillNumber}`,
                    performedBy: performedBy || user.displayName,
                    branchId: fromBranchId
                }
            });
        }

        return order;
    });

    // Send notification to destination branch
    try {
        // Get sender branch name
        const fromBranch = await db.branch.findUnique({
            where: { id: fromBranchId },
            select: { name: true }
        });
        const fromBranchName = fromBranch?.name || 'فرع غير معروف';

        await createNotification({
            branchId: toBranchId,
            type: 'TRANSFER_ORDER',
            title: 'إذن صرف صيانة جديد',
            message: `تم إرسال إذن صرف صيانة جماعي من ${fromBranchName} - رقم ${result.orderNumber} يحتوي على ${serialNumbers.length} ماكينة - بوليصة: ${waybillNumber}`,
            data: {
                orderId: result.id,
                orderNumber: result.orderNumber,
                fromBranchName,
                fromBranchId,
                machineCount: serialNumbers.length,
                waybillNumber
            },
            link: `/receive-orders?orderId=${result.id}`
        });
    } catch (notifErr) {
        console.warn('Failed to create notification for bulk transfer', notifErr);
    }

    return result;
}

// Export including new helper
async function listTransferOrders({ branchId, status, type, fromDate, toDate, q, externalBranchId }, user) {
    let where = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (fromDate || toDate) {
        where.createdAt = {};
        if (fromDate) where.createdAt.gte = new Date(fromDate);
        if (toDate) where.createdAt.lte = new Date(toDate);
    }
    if (q) {
        where.AND = [{ OR: [{ orderNumber: { contains: q } }, { items: { some: { serialNumber: { contains: q } } } }] }];
    }

    // Apply branch scoping (from/to) based on user role or provided branchId
    const args = applyTransferBranchFilter({ where, include: { fromBranch: true, toBranch: true, items: true, _count: { select: { items: true } } }, orderBy: { createdAt: 'desc' } }, user, branchId || externalBranchId);

    const orders = await db.transferOrder.findMany(args);
    return orders;
}

async function getPendingOrders({ branchId, type }, user, req) {
    let where = { status: 'PENDING' };
    if (type) where.type = type;

    const args = applyTransferBranchFilter({ where, include: { fromBranch: true, toBranch: true, items: true }, orderBy: { createdAt: 'desc' } }, user, branchId);

    const orders = await db.transferOrder.findMany(args);
    return orders;
}

async function getPendingSerials({ branchId, type }, user) {
    let transferWhere = { status: 'PENDING' };
    if (type) transferWhere.type = type;

    const transferArgs = applyTransferBranchFilter({ where: transferWhere }, user, branchId);

    const pendingItems = await db.transferOrderItem.findMany({ where: { transferOrder: transferArgs.where }, select: { serialNumber: true } });
    return pendingItems.map(i => i.serialNumber).filter(s => s);
}

async function getTransferOrderById(id, user) {
    const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
    let order;
    if (isAdmin) {
        order = await db.transferOrder.findFirst({
            where: { id, branchId: { not: null } },
            include: { fromBranch: true, toBranch: true, items: true }
        });
    } else {
        if (!user.branchId) { const err = new Error('Access denied'); err.status = 403; throw err; }
        order = await db.transferOrder.findFirst({
            where: {
                id,
                branchId: user.branchId,
                OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
            },
            include: { fromBranch: true, toBranch: true, items: true }
        });
    }

    if (!order) { const err = new Error('الإذن غير موجود'); err.status = 404; throw err; }
    return order;
}

async function importTransferFromExcel(buffer, { branchId, type, createdBy, createdByName, notes }, user) {
    if (!buffer) { const err = new Error('File required'); err.status = 400; throw err; }
    if (!branchId || !type) { const err = new Error('Branch and type required'); err.status = 400; throw err; }

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.worksheets[0];
    const items = [];
    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const serialNumber = row.getCell(1).value?.toString()?.trim();
        if (!serialNumber) return;
        const itemType = row.getCell(2).value?.toString()?.trim() || null;
        const manufacturer = row.getCell(3).value?.toString()?.trim() || null;
        const itemNotes = row.getCell(4).value?.toString()?.trim() || null;
        items.push({ serialNumber, type: itemType, manufacturer, notes: itemNotes });
    });
    if (items.length === 0) { const err = new Error('No valid items'); err.status = 400; throw err; }

    // Create order inside transaction and notify after commit
    const orderNumber = await generateOrderNumber();
    const order = await db.$transaction(async (tx) => {
        const o = await tx.transferOrder.create({ data: { orderNumber, branchId, type, createdBy: createdBy || 'system', createdByName: createdByName || 'النظام', notes, items: { create: items } }, include: { branch: true, items: true } });
        return o;
    });

    try {
        await createNotification({ branchId, type: 'TRANSFER_ORDER', title: 'إذن إدخال جديد', message: `تم إرسال إذن إدخال جديد رقم ${orderNumber} يحتوي على ${items.length} صنف`, data: { orderId: order.id, orderNumber }, link: `/transfer-orders?orderId=${order.id}` });
    } catch (e) { console.warn('Failed to send notification for importTransferFromExcel', e); }

    return { order, imported: items.length };
}

async function rejectOrder(id, { rejectionReason, receivedBy, receivedByName }, user) {
    const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role);
    let order;
    if (isAdmin) {
        order = await db.transferOrder.findFirst({ where: { id, branchId: { not: null } } });
    } else {
        if (!user.branchId) { const err = new Error('Access denied'); err.status = 403; throw err; }
        order = await db.transferOrder.findFirst({
            where: {
                id,
                branchId: user.branchId,
                OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
            }
        });
    }
    if (!order) { const err = new Error('الإذن غير موجود'); err.status = 404; throw err; }
    if (order.status !== 'PENDING') { const err = new Error('الإذن ليس في حالة انتظار'); err.status = 400; throw err; }

    const orderWithItems = isAdmin ? await db.transferOrder.findFirst({
        where: { id, branchId: { not: null } },
        include: { items: true }
    }) : await db.transferOrder.findFirst({
        where: {
            id,
            branchId: user.branchId,
            OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
        },
        include: { items: true }
    });
    const serialNumbers = orderWithItems.items.map(i => i.serialNumber).filter(s => s);

    await db.$transaction(async (tx) => {
        if (orderWithItems.type === 'MACHINE' || orderWithItems.type === 'MAINTENANCE') {
            for (const serial of serialNumbers) {
                const machine = await tx.warehouseMachine.findFirst({
                    where: { serialNumber: serial, branchId: { not: null } }
                });
                const st = machine?.status;
                const isAnyMaintenanceState = st === 'IN_TRANSIT' || st === 'AT_CENTER' || st === 'RECEIVED_AT_CENTER' || st === 'UNDER_MAINTENANCE' || st === 'ASSIGNED';
                if (machine && machine.branchId === orderWithItems.fromBranchId && isAnyMaintenanceState) {
                    let restoredStatus = 'NEW';
                    if (orderWithItems.type === 'MAINTENANCE') restoredStatus = machine.customerId ? 'CLIENT_REPAIR' : 'DEFECTIVE';
                    await tx.warehouseMachine.updateMany({
                        where: { id: machine.id, branchId: { not: null } },
                        data: { status: restoredStatus }
                    });
                    await tx.maintenanceRequest.updateMany({
                        where: { serialNumber: serial, status: 'PENDING_TRANSFER', branchId: orderWithItems.fromBranchId },
                        data: { status: 'Open' }
                    });
                }
            }
        } else if (orderWithItems.type === 'SIM') {
            await tx.warehouseSim.updateMany({ where: { serialNumber: { in: serialNumbers }, branchId: orderWithItems.fromBranchId, status: 'IN_TRANSIT' }, data: { status: 'ACTIVE' } });
        }
    });

    const updated = await db.$transaction(async (tx) => {
        await tx.transferOrder.updateMany({
            where: {
                id,
                branchId: orderWithItems.branchId
            },
            data: {
                status: 'REJECTED',
                rejectionReason,
                receivedBy,
                receivedByName,
                receivedAt: new Date()
            }
        });
        return await tx.transferOrder.findFirst({
            where: { id, branchId: orderWithItems.branchId },
            include: { items: true, fromBranch: true, toBranch: true }
        });
    });
    await createNotification({ branchId: orderWithItems.fromBranchId, type: 'TRANSFER_REJECTED', title: 'تم رفض إذن الصرف', message: `تم رفض إذن الصرف رقم ${order.orderNumber}${rejectionReason ? `: ${rejectionReason}` : ''}`, data: { orderId: order.id, orderNumber: order.orderNumber }, link: `/transfer-orders?orderId=${order.id}` });
    return updated;
}

async function cancelOrder(id, user) {
    const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS'].includes(user.role);
    let order;
    if (isAdmin) {
        order = await db.transferOrder.findFirst({
            where: { id, branchId: { not: null } },
            include: { items: true }
        });
    } else {
        if (!user.branchId) { const err = new Error('Access denied'); err.status = 403; throw err; }
        order = await db.transferOrder.findFirst({
            where: {
                id,
                branchId: user.branchId,
                OR: [{ toBranchId: user.branchId }, { fromBranchId: user.branchId }]
            },
            include: { items: true }
        });
    }
    if (!order) { const err = new Error('الإذن غير موجود'); err.status = 404; throw err; }
    const isCreator = user.id === order.createdByUserId;

    const isAdminOrAffairs = isAdmin;
    if (!isCreator && !isAdmin) { const err = new Error('غير مصرح لك بإلغاء هذا الإذن'); err.status = 403; throw err; }
    if (order.status !== 'PENDING') { const err = new Error('لا يمكن إلغاء إذن غير معلق'); err.status = 400; throw err; }

    const serialNumbers = order.items.map(item => item.serialNumber).filter(s => s);
    await db.$transaction(async (tx) => {
        if (order.type === 'MACHINE' || order.type === 'MAINTENANCE') {
            const restoredStatus = order.type === 'MAINTENANCE' ? 'DEFECTIVE' : 'NEW';
            await tx.warehouseMachine.updateMany({ where: { serialNumber: { in: serialNumbers }, branchId: order.fromBranchId, status: 'IN_TRANSIT' }, data: { status: restoredStatus } });
        } else if (order.type === 'SIM') {
            await tx.warehouseSim.updateMany({ where: { serialNumber: { in: serialNumbers }, branchId: order.fromBranchId, status: 'IN_TRANSIT' }, data: { status: 'ACTIVE' } });
        }

        await tx.transferOrder.updateMany({
            where: {
                id,
                branchId: order.branchId
            },
            data: {
                status: 'CANCELLED',
                receivedBy: user.id,
                receivedByName: user.displayName || user.name,
                rejectionReason: 'تم الإلغاء من قبل المرسل'
            }
        });

        if (order.type === 'MAINTENANCE') {
            await tx.maintenanceRequest.updateMany({ where: { serialNumber: { in: serialNumbers }, status: 'PENDING_TRANSFER', branchId: order.fromBranchId }, data: { status: 'Open' } });
        }
    });

    return { message: 'تم إلغاء الإذن بنجاح' };
}

async function getStatsSummary({ branchId, fromDate, toDate }, user) {
    // Correctly initialize queryArgs to match what applyTransferBranchFilter expects
    let queryArgs = { where: {} };

    // Apply branch filter first to the queryArgs
    queryArgs = applyTransferBranchFilter(queryArgs, user, branchId);

    // Now adding date filters to the where clause inside queryArgs
    if (fromDate || toDate) {
        queryArgs.where.createdAt = {};
        if (fromDate) queryArgs.where.createdAt.gte = new Date(fromDate);
        if (toDate) queryArgs.where.createdAt.lte = new Date(toDate);
    }

    const where = queryArgs.where;

    // Use 'where' correctly in Prisma calls
    const [total, pending, received, partial, rejected] = await Promise.all([
        db.transferOrder.count({ where: { ...where, branchId: where.branchId || { not: null } } }),
        db.transferOrder.count({ where: { ...where, status: 'PENDING' } }),
        db.transferOrder.count({ where: { ...where, status: 'RECEIVED' } }),
        db.transferOrder.count({ where: { ...where, status: 'PARTIAL' } }),
        db.transferOrder.count({ where: { ...where, status: 'REJECTED' } })
    ]);

    const itemStats = await db.transferOrderItem.groupBy({
        by: ['isReceived'],
        where: { transferOrder: where },
        _count: true
    });

    return {
        orders: { total, pending, received, partial, rejected },
        items: {
            total: itemStats.reduce((acc, s) => acc + s._count, 0),
            received: itemStats.find(s => s.isReceived)?._count || 0,
            pending: itemStats.find(s => !s.isReceived)?._count || 0
        }
    };
}

module.exports = { createTransferOrder, receiveTransferOrder, createBulkTransfer, listTransferOrders, getPendingOrders, getPendingSerials, getTransferOrderById, importTransferFromExcel, rejectOrder, cancelOrder, getStatsSummary };

