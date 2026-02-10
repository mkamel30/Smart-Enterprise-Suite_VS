const db = require('../db');
const movementService = require('./movementService');
const { detectMachineParams } = require('../utils/machine-validation');
const { logAction } = require('../utils/logger');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

/**
 * Import machines in bulk
 */
async function importMachines(machines, branchId, performedBy = 'System') {
    if (!Array.isArray(machines)) {
        const err = new Error('الماكينات يجب أن تكون قائمة (Array)');
        err.status = 400;
        throw err;
    }

    if (!branchId) {
        const err = new Error('معرف الفرع مطلوب للاستيراد');
        err.status = 400;
        throw err;
    }

    const machineParams = await db.machineParameter.findMany();
    const results = { success: 0, failed: 0, errors: [] };

    for (const machine of machines) {
        try {
            const serialNumber = String(machine.serialNumber);
            const existing = await db.warehouseMachine.findFirst({
                where: { serialNumber, branchId: { not: null } }
            });

            if (existing) {
                if (existing.branchId !== branchId) {
                    throw new Error(`الماكينة موجودة في فرع آخر (${existing.branchId})`);
                }

                if (existing.status !== machine.status) {
                    await movementService.logMachineMovement(db, {
                        machineId: existing.id,
                        serialNumber: existing.serialNumber,
                        action: 'STATUS_CHANGE',
                        details: `تغيرت من ${existing.status} إلى ${machine.status} عبر الاستيراد`,
                        performedBy,
                        branchId: existing.branchId
                    });
                }

                await db.warehouseMachine.updateMany({
                    where: { serialNumber, branchId: existing.branchId },
                    data: {
                        status: machine.status,
                        model: machine.model || existing.model,
                        manufacturer: machine.manufacturer || existing.manufacturer,
                        notes: machine.notes || existing.notes
                    }
                });
                results.success++;
            } else {
                const existsWithCustomer = await db.posMachine.findFirst({
                    where: { serialNumber, branchId: { not: null } },
                    include: { customer: { include: { branch: true } } }
                });
                if (existsWithCustomer) {
                    if (existsWithCustomer.customer && existsWithCustomer.customer.branchId !== branchId) {
                        const branchName = existsWithCustomer.customer.branch?.name || existsWithCustomer.customer.branchId;
                        throw new Error(`ماكينة مسجلة لدى عميل في فرع "${branchName}"`);
                    }
                    throw new Error(`ماكينة مسجلة لدى عميل (${existsWithCustomer.customer?.client_name || existsWithCustomer.customerId})`);
                }

                const detectedParams = detectMachineParams(serialNumber, machineParams);
                const finalModel = machine.model ? String(machine.model) : detectedParams.model;
                const finalManufacturer = machine.manufacturer ? String(machine.manufacturer) : detectedParams.manufacturer;

                const newMachine = await db.warehouseMachine.create({
                    data: {
                        branchId,
                        serialNumber,
                        model: finalModel,
                        manufacturer: finalManufacturer,
                        status: machine.status || 'NEW',
                        notes: machine.notes ? String(machine.notes) : null
                    }
                });

                await movementService.logMachineMovement(db, {
                    machineId: newMachine.id,
                    serialNumber: newMachine.serialNumber,
                    action: 'IMPORT',
                    details: `تم الاستيراد بحالة ${machine.status} للفرع ${branchId}`,
                    performedBy,
                    branchId
                });
                results.success++;
            }
        } catch (err) {
            results.failed++;
            results.errors.push({ serial: machine.serialNumber, error: err.message });
        }
    }

    return results;
}

/**
 * Manually create a single machine
 */
async function createMachine(data, user) {
    const { canAccessBranch } = require('../middleware/permissions');
    const branchId = data.branchId || user.branchId;
    if (!branchId) {
        const err = new Error('معرف الفرع مفقود');
        err.status = 400;
        throw err;
    }

    if (!await canAccessBranch({ user }, branchId, db)) {
        const err = new Error('ليس لديك صلاحية الوصول لهذا الفرع');
        err.status = 403;
        throw err;
    }

    const existsWithCustomer = await db.posMachine.findFirst({
        where: { serialNumber: data.serialNumber, branchId: { not: null } }
    });
    if (existsWithCustomer) {
        const err = new Error(`الماكينة موجودة بالفعل لدى عميل برقم تعريف: ${existsWithCustomer.customerId}`);
        err.status = 400;
        throw err;
    }

    const existing = await db.warehouseMachine.findFirst({
        where: { serialNumber: data.serialNumber, branchId: { not: null } }
    });
    if (existing) {
        const err = new Error(`الماكينة موجودة بالفعل في المخزن (ID: ${existing.id})`);
        err.status = 400;
        throw err;
    }

    const machine = await db.warehouseMachine.create({
        data: { ...data, branchId, performedBy: undefined } // Remove performedBy from data
    });

    await movementService.logMachineMovement(db, {
        machineId: machine.id,
        serialNumber: machine.serialNumber,
        action: 'CREATE',
        details: `تمت الإضافة يدوياً بحالة ${machine.status} للفرع ${branchId}`,
        performedBy: data.performedBy || user.displayName || user.name || 'System',
        branchId
    });

    return machine;
}

/**
 * Return machine from client to warehouse
 */
async function returnMachineFromClient(payload, user) {
    const {
        machineId, // PosMachine ID
        customerId,
        reason,
        notes,
        complaint,
        performedBy = 'System',
        status: requestedStatus
    } = payload;

    const { canAccessBranch } = require('../middleware/permissions');
    const branchId = payload.branchId || user.branchId;
    if (!branchId) throw new Error('معرف الفرع مطلوب');

    if (!await canAccessBranch({ user }, branchId, db)) {
        throw new Error('ليس لديك صلاحية الوصول لهذا الفرع');
    }

    const validStatuses = ['CLIENT_REPAIR', 'STANDBY', 'DEFECTIVE', 'NEW'];
    const status = (requestedStatus && validStatuses.includes(requestedStatus))
        ? requestedStatus
        : 'CLIENT_REPAIR';

    return await db.$transaction(async (tx) => {
        // 1. Fetch Customer
        const customer = await tx.customer.findFirst({
            where: { bkcode: customerId, branchId },
            select: { id: true, client_name: true, bkcode: true, branchId: true }
        });

        if (!customer) throw new Error('العميل غير موجود');
        // Hierarchical check already covered by findFirst with branchId and canAccessBranch above
        // But for safety:
        if (!await canAccessBranch({ user }, customer.branchId, tx)) throw new Error('ليس لديك صلاحية الوصول لهذا العميل');

        // 2. Find Valid Machine
        const posMachine = await tx.posMachine.findFirst({
            where: { id: machineId, branchId: { not: null } }
        });

        if (!posMachine) throw new Error('الماكينة غير موجودة');
        if (posMachine.customerId !== customer.id) throw new Error('هذه الماكينة لا تنتمي لهذا العميل');

        const reportData = {
            customer: customer,
            machine: {
                serialNumber: posMachine.serialNumber,
                model: posMachine.model,
                manufacturer: posMachine.manufacturer
            },
            reason,
            complaint,
            notes,
            timestamp: new Date().toISOString()
        };

        // 3. Remove from Client
        await tx.posMachine.deleteMany({
            where: { id: machineId, branchId: { not: null } }
        });

        // 4. Add/Update logic
        const existingWarehouse = await tx.warehouseMachine.findFirst({
            where: { serialNumber: posMachine.serialNumber, branchId: { not: null } }
        });

        let machine;
        if (existingWarehouse) {
            machine = await tx.warehouseMachine.updateMany({
                where: { id: existingWarehouse.id, branchId: { not: null } },
                data: {
                    status: status,
                    complaint: complaint || notes,
                    notes: notes,
                    originalOwnerId: customerId,
                    branchId: branchId
                }
            });
            await movementService.logMachineMovement(tx, {
                machineId: existingWarehouse.id,
                serialNumber: existingWarehouse.serialNumber,
                action: 'RETURN_FROM_CLIENT',
                details: reportData,
                performedBy: performedBy || user.displayName || user.name || 'System',
                branchId: branchId
            });
        } else {
            const newMachine = await tx.warehouseMachine.create({
                data: {
                    branchId: branchId,
                    serialNumber: posMachine.serialNumber,
                    model: posMachine.model,
                    manufacturer: posMachine.manufacturer,
                    status: status,
                    complaint: complaint || notes,
                    notes: notes,
                    originalOwnerId: customerId
                }
            });
            machine = newMachine;
            await movementService.logMachineMovement(tx, {
                machineId: newMachine.id,
                serialNumber: newMachine.serialNumber,
                action: 'RETURN_FROM_CLIENT',
                details: reportData,
                performedBy: performedBy || user.displayName || user.name || 'System',
                branchId: branchId
            });
        }

        // 5. Audit Logging
        await logAction({
            entityType: 'CUSTOMER',
            entityId: customerId,
            action: 'MACHINE_RETURN',
            details: `إرجاع ماكينة: ${posMachine.serialNumber}. السبب: ${reason || 'غير محدد'}`,
            performedBy: performedBy || user.displayName || user.name || 'System',
            branchId: branchId
        });

        return { success: true };
    });
}

/**
 * Exchange machine for client
 */
async function exchangeMachine(payload, user) {
    const {
        outgoingMachineId,
        customerId,
        incomingMachineId,
        incomingNotes,
        performedBy = 'System'
    } = payload;

    const branchId = user.branchId || payload.branchId;
    const incomingStatus = 'CLIENT_REPAIR';

    return await db.$transaction(async (tx) => {
        const { canAccessBranch } = require('../middleware/permissions');

        // 1. Process Outgoing (Warehouse -> Client)
        const outgoing = await tx.warehouseMachine.findFirst({
            where: { id: outgoingMachineId, branchId: { not: null } }
        });
        if (!outgoing) throw new Error('الماكينة الصادرة غير موجودة');
        if (!await canAccessBranch({ user }, outgoing.branchId, tx)) throw new Error('ليس لديك صلاحية الوصول لهذه الماكينة');

        // Check if exists with ANY customer
        const existingPos = await tx.posMachine.findFirst({
            where: { serialNumber: outgoing.serialNumber, branchId: { not: null } }
        });
        if (existingPos) {
            throw new Error(`الماكينة ${outgoing.serialNumber} مسجلة بالفعل لدى عميل برقم تعريف: ${existingPos.customerId}`);
        }

        // Fetch Customer
        const customer = await tx.customer.findFirst({
            where: { bkcode: customerId, branchId },
            select: { id: true, client_name: true, bkcode: true, branchId: true }
        });
        if (!customer) throw new Error('العميل غير موجود');

        // Update warehouse status
        await tx.warehouseMachine.updateMany({
            where: { id: outgoingMachineId, branchId: { not: null } },
            data: { status: 'SOLD' }
        });

        // Create PosMachine
        await tx.posMachine.create({
            data: {
                serialNumber: outgoing.serialNumber,
                model: outgoing.model,
                manufacturer: outgoing.manufacturer,
                customerId: customer.id,
                branchId: customer.branchId,
                isMain: false
            }
        });

        // 2. Process Incoming (Client -> Warehouse)
        const incomingPos = await tx.posMachine.findFirst({
            where: { id: incomingMachineId, branchId: { not: null } }
        });
        if (!incomingPos) throw new Error('الماكينة الواردة غير موجودة');

        const reportData = {
            customer,
            incomingMachine: {
                serialNumber: incomingPos.serialNumber,
                model: incomingPos.model,
                manufacturer: incomingPos.manufacturer,
                status: incomingStatus
            },
            outgoingMachine: {
                serialNumber: outgoing.serialNumber,
                model: outgoing.model,
                manufacturer: outgoing.manufacturer
            },
            notes: incomingNotes,
            timestamp: new Date().toISOString()
        };

        // Log Exchange Out
        await movementService.logMachineMovement(tx, {
            machineId: outgoing.id,
            serialNumber: outgoing.serialNumber,
            action: 'EXCHANGE_OUT',
            details: reportData,
            performedBy: performedBy || user.displayName || user.name || 'System',
            branchId: outgoing.branchId
        });

        // Remove from client
        await tx.posMachine.deleteMany({
            where: { id: incomingMachineId, branchId: { not: null } }
        });

        // Add to Warehouse
        const existingWarehouse = await tx.warehouseMachine.findFirst({
            where: { serialNumber: incomingPos.serialNumber, branchId: { not: null } }
        });

        if (existingWarehouse) {
            await tx.warehouseMachine.updateMany({
                where: { id: existingWarehouse.id, branchId: { not: null } },
                data: {
                    status: incomingStatus,
                    notes: incomingNotes,
                    originalOwnerId: customerId,
                    branchId: branchId
                }
            });
            await movementService.logMachineMovement(tx, {
                machineId: existingWarehouse.id,
                serialNumber: existingWarehouse.serialNumber,
                action: 'EXCHANGE_IN',
                details: reportData,
                performedBy: performedBy || user.displayName || user.name || 'System',
                branchId: branchId
            });
        } else {
            const newWarehouse = await tx.warehouseMachine.create({
                data: {
                    branchId: branchId,
                    serialNumber: incomingPos.serialNumber,
                    model: incomingPos.model,
                    manufacturer: incomingPos.manufacturer,
                    status: incomingStatus,
                    notes: incomingNotes,
                    originalOwnerId: customerId
                }
            });
            await movementService.logMachineMovement(tx, {
                machineId: newWarehouse.id,
                serialNumber: newWarehouse.serialNumber,
                action: 'EXCHANGE_IN',
                details: reportData,
                performedBy: performedBy || user.displayName || user.name || 'System',
                branchId: branchId
            });
        }

        // 3. Audit Logging
        await logAction({
            entityType: 'CUSTOMER',
            entityId: customerId,
            action: 'MACHINE_EXCHANGE',
            details: `استبدال ماكينة ${incomingPos.serialNumber} بالماكينة ${outgoing.serialNumber}`,
            performedBy: performedBy || user.displayName || user.name || 'System',
            branchId: branchId
        });

        return { success: true };
    });
}

/**
 * Return machines to originating branch from maintenance center
 */
async function returnToBranch(payload, user, req) {
    const { serialNumbers, toBranchId, waybillNumber, notes, performedBy } = payload;
    const fromBranchId = user.branchId;

    if (!serialNumbers?.length || !toBranchId) {
        throw new Error('الأرقام التسلسلية وفرع الوجهة مطلوبان');
    }

    // Verify role
    if (!['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN', 'MANAGEMENT'].includes(user.role)) {
        throw new Error('فقط مركز الصيانة أو الإدارة يمكنهم إرجاع الماكينات');
    }

    return await db.$transaction(async (tx) => {
        const machines = await tx.warehouseMachine.findMany(ensureBranchWhere({
            where: {
                serialNumber: { in: serialNumbers },
                branchId: fromBranchId,
                status: 'READY_FOR_RETURN'
            }
        }, req));

        if (machines.length !== serialNumbers.length) {
            const found = machines.map(m => m.serialNumber);
            const missing = serialNumbers.filter(s => !found.includes(s));
            throw new Error(`بعض الماكينات غير جاهزة للإرجاع أو غير موجودة: ${missing.join(', ')}`);
        }

        // Verify destination
        const wrongBranch = machines.filter(m => m.originBranchId && m.originBranchId !== toBranchId);
        if (wrongBranch.length > 0) {
            throw new Error(`بعض الماكينات تنتمي لفروع أخرى: ${wrongBranch.map(m => m.serialNumber).join(', ')}`);
        }

        const orderNumber = `TO-RT-${Date.now()}`;
        const machineMap = new Map(machines.map(m => [m.serialNumber, m]));

        // Create Order
        const order = await tx.transferOrder.create({
            data: {
                orderNumber,
                waybillNumber,
                fromBranchId,
                toBranchId,
                branchId: toBranchId,
                type: 'RETURN',
                notes: notes || 'إرجاع ماكينات من مركز الصيانة',
                createdByUserId: user.id,
                createdByName: performedBy || user.displayName || user.name || 'System',
                items: {
                    create: serialNumbers.map(s => {
                        const m = machineMap.get(s);
                        return {
                            serialNumber: s,
                            type: 'MACHINE',
                            model: m.model,
                            manufacturer: m.manufacturer
                        };
                    })
                }
            }
        });

        // Update Machines
        for (const serial of serialNumbers) {
            const m = machineMap.get(serial);
            await tx.warehouseMachine.updateMany({
                where: { serialNumber: serial, branchId: fromBranchId },
                data: {
                    status: 'RETURNING',
                    notes: `في طريق العودة - إذن ${orderNumber}. بوليصة: ${waybillNumber || 'لا يوجد'}`,
                    branchId: toBranchId
                }
            });

            await tx.machineMovementLog.create({
                data: {
                    machineId: m.id,
                    serialNumber: serial,
                    action: 'RETURN_TO_BRANCH',
                    details: `إرجاع للفرع - إذن ${orderNumber}. النتيجة: ${m.resolution || 'غير محدد'}`,
                    performedBy: performedBy || user.displayName || user.name || 'System',
                    branchId: fromBranchId
                }
            });

            if (m.requestId) {
                await tx.maintenanceRequest.updateMany({
                    where: { id: m.requestId, branchId: fromBranchId },
                    data: {
                        status: 'RETURNING_FROM_CENTER',
                        actionTaken: m.resolution === 'REPAIRED' ? 'تم الإصلاح بمركز الصيانة' : 'تالفة/خردة'
                    }
                });
            }
        }

        return order;
    });
}

/**
 * Receive returned machine at branch
 */
async function receiveReturn(machineId, user, performedBy) {
    return await db.$transaction(async (tx) => {
        const { canAccessBranch } = require('../middleware/permissions');

        const machine = await tx.warehouseMachine.findFirst({
            where: { id: machineId, branchId: { not: null } }
        });

        if (!machine) throw new Error('الماكينة غير موجودة');
        if (machine.status !== 'RETURNING') throw new Error('الماكينة ليست في حالة "في طريق العودة"');
        if (!await canAccessBranch({ user }, machine.branchId, tx)) throw new Error('ليس لديك صلاحية استلام هذه الماكينة');

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'COMPLETED',
                notes: `تم الاستلام من مركز الصيانة - ${machine.resolution || 'غير محدد'}`,
                readyForPickup: machine.resolution === 'REPAIRED'
            }
        });

        await tx.machineMovementLog.create({
            data: {
                machineId: machine.id,
                serialNumber: machine.serialNumber,
                action: 'RECEIVED_FROM_CENTER',
                details: `تم الاستلام النهائي والعملية مكتملة`,
                performedBy: performedBy || user.displayName || user.name || 'System',
                branchId: machine.branchId
            }
        });

        if (machine.requestId) {
            await tx.maintenanceRequest.updateMany({
                where: { id: machine.requestId, branchId: { not: null } },
                data: {
                    status: machine.resolution === 'REPAIRED' ? 'READY_FOR_DELIVERY' : 'Closed'
                }
            });
        }

        return await tx.warehouseMachine.findFirst({ where: { id: machineId } });
    });
}

module.exports = {
    importMachines,
    createMachine,
    returnMachineFromClient,
    exchangeMachine,
    returnToBranch,
    receiveReturn
};
