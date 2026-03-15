const db = require('../../db');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');
const { createNotification } = require('../../routes/notifications');
const { getBranchScope } = require('../../utils/branchSecurity');
const transferService = require('../transferService');

/**
 * Generate unique return order number
 */
async function generateReturnOrderNumber(tx) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastOrder = await tx.transferOrder.findFirst({
        where: {
            orderNumber: { startsWith: `RET-${dateStr}` }
        },
        orderBy: { orderNumber: 'desc' }
    });

    let seq = 1;
    if (lastOrder) {
        const parts = lastOrder.orderNumber.split('-');
        seq = parseInt(parts[2] || '0') + 1;
    }

    return `RET-${dateStr}-${seq.toString().padStart(3, '0')}`;
}

/**
 * Mark machine as total loss
 */
async function markTotalLoss(machineId, { reason, notes }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    const result = await db.$transaction(async (tx) => {
        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                status: { notIn: ['COMPLETED', 'RETURNED'] }
            }
        });

        if (assignment) {
            await tx.serviceAssignment.updateMany({
                where: { id: assignment.id, branchId: machine.branchId },
                data: {
                    status: 'COMPLETED',
                    actionTaken: 'TOTAL_LOSS',
                    resolution: 'TOTAL_LOSS',
                    completedAt: new Date()
                }
            });

            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: assignment.id,
                    action: 'TOTAL_LOSS',
                    details: `تم التصنيف كخسارة كلية - السبب: ${reason}${notes ? ' - ' + notes : ''}`,
                    performedBy: user.displayName || user.email,
                    performedById: user.id
                }
            });
        }

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'TOTAL_LOSS',
                resolution: 'TOTAL_LOSS',
                repairNotes: notes || null,
                updatedAt: new Date()
            }
        });

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'TOTAL_LOSS_DECLARED',
                details: JSON.stringify({ reason, notes }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        return {
            machine: await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: machine.branchId } }),
            assignment,
            returnOrder: null
        };
    });

    await createNotification({
        branchId: machine.originBranchId || machine.branchId,
        type: 'TOTAL_LOSS',
        title: '⚠️ خسارة كلية',
        message: `تم تصنيف الماكينة ${machine.serialNumber} كخسارة كلية - السبب: ${reason}`,
        link: `/maintenance-center/${machineId}`
    });

    return result;
}

/**
 * Return machine to origin branch
 */
async function returnToBranch(machineId, { notes, driverName, driverPhone }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    if (!machine.originBranchId) {
        throw new ValidationError('Machine has no origin branch defined');
    }

    if (!['REPAIRED', 'REPAIR_REJECTED', 'TOTAL_LOSS'].includes(machine.status)) {
        throw new ConflictError(`Machine must be in REPAIRED, REPAIR_REJECTED, or TOTAL_LOSS status to return. Current status: ${machine.status}`);
    }

    const result = await db.$transaction(async (tx) => {
        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                status: { notIn: ['RETURNED'] }
            }
        });

        const orderNumber = await generateReturnOrderNumber(tx);
        const returnOrder = await tx.transferOrder.create({
            data: {
                orderNumber,
                branchId: machine.originBranchId,
                fromBranchId: machine.branchId,
                toBranchId: machine.originBranchId,
                type: 'RETURN_TO_BRANCH',
                status: 'PENDING',
                notes: notes || `إرجاع ماكينة بعد الصيانة - الحالة: ${machine.status}`,
                driverName,
                driverPhone,
                createdBy: user.displayName || user.email,
                createdByUserId: user.id,
                items: {
                    create: [{
                        serialNumber: machine.serialNumber,
                        type: 'MACHINE',
                        model: machine.model,
                        manufacturer: machine.manufacturer
                    }]
                }
            },
            include: { items: true }
        });

        if (assignment) {
            await tx.serviceAssignment.updateMany({
                where: { id: assignment.id, branchId: machine.branchId },
                data: {
                    status: 'RETURNED'
                }
            });

            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: assignment.id,
                    action: 'RETURNED',
                    details: `تم إرجاع الماكينة للفرع - أمر التحويل: ${orderNumber}`,
                    performedBy: user.displayName || user.email,
                    performedById: user.id
                }
            });
        }

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'READY_FOR_RETURN',
                updatedAt: new Date()
            }
        });

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'RETURNED_TO_BRANCH',
                details: JSON.stringify({
                    returnOrderId: returnOrder.id,
                    orderNumber,
                    destinationBranchId: machine.originBranchId,
                    notes
                }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        return {
            machine: await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: machine.branchId } }),
            assignment,
            returnOrder
        };
    });

    await createNotification({
        branchId: machine.originBranchId,
        type: 'RETURN_SCHEDULED',
        title: '📦 إرجاع ماكينة',
        message: `تم تجهيز الماكينة ${machine.serialNumber} للإرجاع - رقم أمر التحويل: ${result.returnOrder.orderNumber}`,
        link: `/transfer-orders/${result.returnOrder.id}`
    });

    return result;
}

/**
 * Get machines ready for return to origin branch
 */
async function getMachinesReadyForReturn(query = {}, user) {
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    const where = {
        ...getBranchScope(user),
        originBranchId: { not: null },
        status: { in: ['REPAIRED', 'TOTAL_LOSS', 'READY_FOR_RETURN'] }
    };

    if (query.search) {
        where.OR = [
            { serialNumber: { contains: query.search } },
            { model: { contains: query.search } }
        ];
    }

    const total = await db.warehouseMachine.count({ where });

    const machines = await db.warehouseMachine.findMany({
        where,
        take: limit,
        skip: skip,
        include: {
            serviceAssignments: {
                where: { status: { not: 'COMPLETED' } },
                orderBy: { assignedAt: 'desc' },
                take: 1,
                select: {
                    technicianName: true,
                    totalCost: true,
                    actionTaken: true,
                    resolution: true
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    const mappedMachines = machines.map(m => {
        const assignment = m.serviceAssignments?.[0];
        const usedParts = m.usedParts ? JSON.parse(m.usedParts) : [];
        const partsCost = Array.isArray(usedParts)
            ? usedParts.reduce((sum, p) => sum + (p.totalCost || 0), 0)
            : 0;
        const laborCost = (m.totalCost || assignment?.totalCost || 0) - partsCost;

        return {
            ...m,
            maintenanceCost: m.totalCost || assignment?.totalCost || 0,
            partsCost,
            laborCost,
            resolution: m.status === 'TOTAL_LOSS' ? 'فقدان كلي' : (assignment?.resolution || assignment?.actionTaken || 'تم الإصلاح'),
            technicianName: assignment?.technicianName || m.currentTechnicianName
        };
    });

    return {
        data: mappedMachines,
        pagination: {
            total,
            page,
            limit,
            pages: Math.ceil(total / limit)
        }
    };
}



/**
 * Create a return package (transfer) to send machines back to origin branch
 */
async function createReturnPackage({ machineIds, notes, driverName, driverPhone }, user) {
    if (!machineIds || machineIds.length === 0) {
        throw new ValidationError('يرجى اختيار ماكينة واحدة على الأقل');
    }

    const machines = await db.warehouseMachine.findMany({
        where: {
            id: { in: machineIds },
            ...getBranchScope(user),
            originBranchId: { not: null }
        },
        include: {
            serviceAssignments: {
                where: { status: { not: 'COMPLETED' } },
                orderBy: { assignedAt: 'desc' },
                take: 1
            }
        }
    });

    if (machines.length === 0) {
        throw new NotFoundError('لم يتم العثور على ماكينات صالحة للإرجاع');
    }

    const invalidMachines = machines.filter(m =>
        !['REPAIRED', 'TOTAL_LOSS', 'READY_FOR_RETURN'].includes(m.status)
    );

    if (invalidMachines.length > 0) {
        throw new ValidationError(
            `الماكينة التالية غير صالحة للإرجاع: ${invalidMachines.map(m => m.serialNumber).join(', ')}`
        );
    }

    const machinesByBranch = machines.reduce((acc, machine) => {
        const branchId = machine.originBranchId;
        if (!acc[branchId]) {
            acc[branchId] = [];
        }
        acc[branchId].push(machine);
        return acc;
    }, {});

    const branchCosts = {};
    for (const [branchId, branchMachines] of Object.entries(machinesByBranch)) {
        let totalCost = 0;
        let totalPartsCost = 0;
        let freeRepairs = 0;
        let paidRepairs = 0;

        for (const machine of branchMachines) {
            const assignment = machine.serviceAssignments?.[0];
            const cost = machine.totalCost || assignment?.totalCost || 0;
            totalCost += cost;
            totalPartsCost += machine.usedParts ? JSON.parse(machine.usedParts).reduce((sum, p) => sum + (p.totalCost || 0), 0) : 0;

            if (cost > 0) {
                paidRepairs++;
            } else {
                freeRepairs++;
            }
        }

        branchCosts[branchId] = {
            totalCost,
            totalPartsCost,
            laborCost: totalCost - totalPartsCost,
            freeRepairs,
            paidRepairs,
            machineCount: branchMachines.length
        };
    }

    const createdOrders = [];

    for (const [originBranchId, branchMachines] of Object.entries(machinesByBranch)) {
        const costs = branchCosts[originBranchId];
        const orderNumber = await transferService.generateOrderNumber();

        const order = await db.$transaction(async (tx) => {
            const transferOrder = await tx.transferOrder.create({
                data: {
                    orderNumber,
                    fromBranchId: user.branchId,
                    toBranchId: originBranchId,
                    branchId: originBranchId,
                    type: 'RETURN_TO_BRANCH',
                    notes: notes || '',
                    createdBy: user.displayName || user.email,
                    createdByUserId: user.id,
                    driverName,
                    driverPhone,
                    items: {
                        create: branchMachines.map(m => ({
                            serialNumber: m.serialNumber,
                            type: m.model || 'Unknown',
                            manufacturer: m.manufacturer || 'Unknown',
                            isReceived: false,
                            notes: `التكلفة: ${costs.totalCost} ج.م | ${m.status === 'TOTAL_LOSS' ? 'فقدان كلي' : 'تم الإصلاح'}`
                        }))
                    }
                },
                include: { items: true, fromBranch: true, toBranch: true }
            });

            await tx.warehouseMachine.updateMany({
                where: {
                    id: { in: branchMachines.map(m => m.id) },
                    branchId: user.branchId
                },
                data: {
                    status: 'IN_RETURN_TRANSIT',
                    originBranchId: null,
                    notes: `طرد إرجاع رقم ${orderNumber}`
                }
            });

            for (const machine of branchMachines) {
                await tx.machineMovementLog.create({
                    data: {
                        machineId: machine.id,
                        serialNumber: machine.serialNumber,
                        action: 'RETURN_TO_BRANCH',
                        details: JSON.stringify({
                            orderNumber,
                            orderType: 'RETURN_TO_BRANCH',
                            toBranchId: originBranchId,
                            status: 'IN_RETURN_TRANSIT',
                            maintenanceCost: costs.totalCost,
                            maintenanceDetails: {
                                freeRepairs: costs.freeRepairs,
                                paidRepairs: costs.paidRepairs,
                                partsCost: costs.totalPartsCost,
                                laborCost: costs.laborCost,
                                totalCost: costs.totalCost,
                                resolution: machine.status === 'TOTAL_LOSS' ? 'فقدان كلي' : 'تم الإصلاح'
                            }
                        }),
                        performedBy: user.displayName || user.email,
                        branchId: user.branchId
                    }
                });
            }

            if (costs.totalCost > 0) {
                await tx.branchDebt.create({
                    data: {
                        type: 'MAINTENANCE_COST',
                        referenceId: transferOrder.id,
                        machineSerial: branchMachines.map(m => m.serialNumber).join(', '),
                        customerId: null,
                        customerName: branchMachines.map(m => m.customerName).filter(Boolean).join(', '),
                        amount: costs.totalCost,
                        paidAmount: 0,
                        remainingAmount: costs.totalCost,
                        partsDetails: JSON.stringify({
                            partsCost: costs.totalPartsCost,
                            laborCost: costs.laborCost,
                            machineCount: costs.machineCount,
                            freeRepairs: costs.freeRepairs,
                            paidRepairs: costs.paidRepairs
                        }),
                        status: 'PENDING',
                        creditorBranchId: user.branchId,
                        debtorBranchId: originBranchId,
                        receiptNumber: orderNumber
                    }
                });
            }

            return transferOrder;
        });

        createdOrders.push({
            ...order,
            costs: costs,
            machineCount: branchMachines.length
        });

        try {
            await createNotification({
                branchId: originBranchId,
                type: 'RETURN_SHIPMENT',
                title: '📦 شحنة إرجاع من الصيانة',
                message: `تم إرسال شحنة إرجاع ${branchMachines.length} ماكينة من مركز الصيانة - إذن رقم ${orderNumber}`,
                data: { orderId: order.id, orderNumber, machineCount: branchMachines.length },
                link: `/receive-orders?orderId=${order.id}`
            });
        } catch (e) {
            console.warn('Failed to create notification for return shipment', e);
        }
    }

    return {
        message: `تم إنشاء ${createdOrders.length} إذن إرجاع`,
        orders: createdOrders,
        summary: {
            totalMachines: machines.length,
            totalCost: Object.values(branchCosts).reduce((sum, c) => sum + c.totalCost, 0),
            branchBreakdown: Object.entries(branchCosts).map(([branchId, costs]) => ({
                branchId,
                machineCount: costs.machineCount,
                totalCost: costs.totalCost
            }))
        }
    };
}

module.exports = {
    markTotalLoss,
    returnToBranch,
    getMachinesReadyForReturn,
    createReturnPackage
};
