const db = require('../../../db');
const movementService = require('../shared/movement.service.js');
const { detectMachineParams } = require('../../../utils/machine-validation');
const { logAction } = require('../../../utils/logger');
const { ensureBranchWhere } = require('../../../prisma/branchHelpers');

/**
 * Import machines in bulk
 */
async function importMachines(machines, branchId, performedBy = 'System') {
    if (!Array.isArray(machines)) {
        const err = new Error('ÇáãÇßíäÇÊ íÌÈ Ãä Êßæä ÞÇÆãÉ (Array)');
        err.status = 400;
        throw err;
    }

    if (!branchId) {
        const err = new Error('ãÚÑÝ ÇáÝÑÚ ãØáæÈ ááÇÓÊíÑÇÏ');
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
                    throw new Error(`ÇáãÇßíäÉ ãæÌæÏÉ Ýí ÝÑÚ ÂÎÑ (${existing.branchId})`);
                }

                if (existing.status !== machine.status) {
                    await movementService.logMachineMovement(db, {
                        machineId: existing.id,
                        serialNumber: existing.serialNumber,
                        action: 'STATUS_CHANGE',
                        details: `ÊÛíÑÊ ãä ${existing.status} Åáì ${machine.status} ÚÈÑ ÇáÇÓÊíÑÇÏ`,
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
                        throw new Error(`ãÇßíäÉ ãÓÌáÉ áÏì Úãíá Ýí ÝÑÚ "${branchName}"`);
                    }
                    throw new Error(`ãÇßíäÉ ãÓÌáÉ áÏì Úãíá (${existsWithCustomer.customer?.client_name || existsWithCustomer.customerId})`);
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
                    details: `Êã ÇáÇÓÊíÑÇÏ ÈÍÇáÉ ${machine.status} ááÝÑÚ ${branchId}`,
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
    const { canAccessBranch } = require('../../../middleware/permissions');
    const branchId = data.branchId || user.branchId;
    if (!branchId) {
        const err = new Error('ãÚÑÝ ÇáÝÑÚ ãÝÞæÏ');
        err.status = 400;
        throw err;
    }

    if (!await canAccessBranch({ user }, branchId, db)) {
        const err = new Error('áíÓ áÏíß ÕáÇÍíÉ ÇáæÕæá áåÐÇ ÇáÝÑÚ');
        err.status = 403;
        throw err;
    }

    const existsWithCustomer = await db.posMachine.findFirst({
        where: { serialNumber: data.serialNumber, branchId: { not: null } }
    });
    if (existsWithCustomer) {
        const err = new Error(`ÇáãÇßíäÉ ãæÌæÏÉ ÈÇáÝÚá áÏì Úãíá ÈÑÞã ÊÚÑíÝ: ${existsWithCustomer.customerId}`);
        err.status = 400;
        throw err;
    }

    const existing = await db.warehouseMachine.findFirst({
        where: { serialNumber: data.serialNumber, branchId: { not: null } }
    });
    if (existing) {
        const err = new Error(`ÇáãÇßíäÉ ãæÌæÏÉ ÈÇáÝÚá Ýí ÇáãÎÒä (ID: ${existing.id})`);
        err.status = 400;
        throw err;
    }

    const machineParams = await db.machineParameter.findMany();
    const detectedParams = detectMachineParams(data.serialNumber, machineParams);
    const finalModel = data.model || detectedParams.model || '-';
    const finalManufacturer = data.manufacturer || detectedParams.manufacturer || '-';

    const machine = await db.warehouseMachine.create({
        data: {
            ...data,
            branchId,
            model: finalModel,
            manufacturer: finalManufacturer,
            performedBy: undefined
        }
    });

    await movementService.logMachineMovement(db, {
        machineId: machine.id,
        serialNumber: machine.serialNumber,
        action: 'CREATE',
        details: `ÊãÊ ÇáÅÖÇÝÉ íÏæíÇð ÈÍÇáÉ ${machine.status} ááÝÑÚ ${branchId}`,
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

    const { canAccessBranch } = require('../../../middleware/permissions');
    const branchId = payload.branchId || user.branchId;
    if (!branchId) throw new Error('ãÚÑÝ ÇáÝÑÚ ãØáæÈ');

    if (!await canAccessBranch({ user }, branchId, db)) {
        throw new Error('áíÓ áÏíß ÕáÇÍíÉ ÇáæÕæá áåÐÇ ÇáÝÑÚ');
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

        if (!customer) throw new Error('ÇáÚãíá ÛíÑ ãæÌæÏ');
        // Hierarchical check already covered by findFirst with branchId and canAccessBranch above
        // But for safety:
        if (!await canAccessBranch({ user }, customer.branchId, tx)) throw new Error('áíÓ áÏíß ÕáÇÍíÉ ÇáæÕæá áåÐÇ ÇáÚãíá');

        // 2. Find Valid Machine
        const posMachine = await tx.posMachine.findFirst({
            where: { id: machineId, branchId: { not: null } }
        });

        if (!posMachine) throw new Error('ÇáãÇßíäÉ ÛíÑ ãæÌæÏÉ');
        if (posMachine.customerId !== customer.id) throw new Error('åÐå ÇáãÇßíäÉ áÇ ÊäÊãí áåÐÇ ÇáÚãíá');

        // Detect model/manufacturer if missing
        const machineParams = await tx.machineParameter.findMany();
        const detected = detectMachineParams(posMachine.serialNumber, machineParams);
        posMachine.model = posMachine.model || detected.model || '-';
        posMachine.manufacturer = posMachine.manufacturer || detected.manufacturer || '-';

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
            details: `ÅÑÌÇÚ ãÇßíäÉ: ${posMachine.serialNumber}. ÇáÓÈÈ: ${reason || 'ÛíÑ ãÍÏÏ'}`,
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
        const { canAccessBranch } = require('../../../middleware/permissions');

        // 1. Process Outgoing (Warehouse -> Client)
        const outgoing = await tx.warehouseMachine.findFirst({
            where: { id: outgoingMachineId, branchId: { not: null } }
        });
        if (!outgoing) throw new Error('ÇáãÇßíäÉ ÇáÕÇÏÑÉ ÛíÑ ãæÌæÏÉ');
        if (!await canAccessBranch({ user }, outgoing.branchId, tx)) throw new Error('áíÓ áÏíß ÕáÇÍíÉ ÇáæÕæá áåÐå ÇáãÇßíäÉ');

        // Check if exists with ANY customer
        const existingPos = await tx.posMachine.findFirst({
            where: { serialNumber: outgoing.serialNumber, branchId: { not: null } }
        });
        if (existingPos) {
            throw new Error(`ÇáãÇßíäÉ ${outgoing.serialNumber} ãÓÌáÉ ÈÇáÝÚá áÏì Úãíá ÈÑÞã ÊÚÑíÝ: ${existingPos.customerId}`);
        }

        // Fetch Customer
        const customer = await tx.customer.findFirst({
            where: { bkcode: customerId, branchId },
            select: { id: true, client_name: true, bkcode: true, branchId: true }
        });
        if (!customer) throw new Error('ÇáÚãíá ÛíÑ ãæÌæÏ');

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
                branchId: customer.branchId
            }
        });

        // 2. Process Incoming (Client -> Warehouse)
        const incomingPos = await tx.posMachine.findFirst({
            where: { id: incomingMachineId, branchId: { not: null } }
        });
        if (!incomingPos) throw new Error('ÇáãÇßíäÉ ÇáæÇÑÏÉ ÛíÑ ãæÌæÏÉ');

        // Detect model/manufacturer if missing
        const machineParams = await tx.machineParameter.findMany();
        const detectedOut = detectMachineParams(outgoing.serialNumber, machineParams);
        outgoing.model = outgoing.model || detectedOut.model || '-';
        outgoing.manufacturer = outgoing.manufacturer || detectedOut.manufacturer || '-';

        const detectedIn = detectMachineParams(incomingPos.serialNumber, machineParams);
        incomingPos.model = incomingPos.model || detectedIn.model || '-';
        incomingPos.manufacturer = incomingPos.manufacturer || detectedIn.manufacturer || '-';

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
            details: `ÇÓÊÈÏÇá ãÇßíäÉ ${incomingPos.serialNumber} ÈÇáãÇßíäÉ ${outgoing.serialNumber}`,
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
        throw new Error('ÇáÃÑÞÇã ÇáÊÓáÓáíÉ æÝÑÚ ÇáæÌåÉ ãØáæÈÇä');
    }

    // Verify role
    if (!['CENTER_MANAGER', 'CENTER_TECH', 'SUPER_ADMIN', 'MANAGEMENT'].includes(user.role)) {
        throw new Error('ÝÞØ ãÑßÒ ÇáÕíÇäÉ Ãæ ÇáÅÏÇÑÉ íãßäåã ÅÑÌÇÚ ÇáãÇßíäÇÊ');
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
            throw new Error(`ÈÚÖ ÇáãÇßíäÇÊ ÛíÑ ÌÇåÒÉ ááÅÑÌÇÚ Ãæ ÛíÑ ãæÌæÏÉ: ${missing.join(', ')}`);
        }

        // Verify destination
        const wrongBranch = machines.filter(m => m.originBranchId && m.originBranchId !== toBranchId);
        if (wrongBranch.length > 0) {
            throw new Error(`ÈÚÖ ÇáãÇßíäÇÊ ÊäÊãí áÝÑæÚ ÃÎÑì: ${wrongBranch.map(m => m.serialNumber).join(', ')}`);
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
                notes: notes || 'ÅÑÌÇÚ ãÇßíäÇÊ ãä ãÑßÒ ÇáÕíÇäÉ',
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
                    notes: `Ýí ØÑíÞ ÇáÚæÏÉ - ÅÐä ${orderNumber}. ÈæáíÕÉ: ${waybillNumber || 'áÇ íæÌÏ'}`,
                    branchId: toBranchId
                }
            });

            await tx.machineMovementLog.create({
                data: {
                    machineId: m.id,
                    serialNumber: serial,
                    action: 'RETURN_TO_BRANCH',
                    details: `ÅÑÌÇÚ ááÝÑÚ - ÅÐä ${orderNumber}. ÇáäÊíÌÉ: ${m.resolution || 'ÛíÑ ãÍÏÏ'}`,
                    performedBy: performedBy || user.displayName || user.name || 'System',
                    branchId: fromBranchId
                }
            });

            if (m.requestId) {
                await tx.maintenanceRequest.updateMany({
                    where: { id: m.requestId, branchId: fromBranchId },
                    data: {
                        status: 'RETURNING_FROM_CENTER',
                        actionTaken: m.resolution === 'REPAIRED' ? 'Êã ÇáÅÕáÇÍ ÈãÑßÒ ÇáÕíÇäÉ' : 'ÊÇáÝÉ/ÎÑÏÉ'
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
        const { canAccessBranch } = require('../../../middleware/permissions');

        const machine = await tx.warehouseMachine.findFirst({
            where: { id: machineId, branchId: { not: null } }
        });

        if (!machine) throw new Error('ÇáãÇßíäÉ ÛíÑ ãæÌæÏÉ');
        if (machine.status !== 'RETURNING') throw new Error('ÇáãÇßíäÉ áíÓÊ Ýí ÍÇáÉ "Ýí ØÑíÞ ÇáÚæÏÉ"');
        if (!await canAccessBranch({ user }, machine.branchId, tx)) throw new Error('áíÓ áÏíß ÕáÇÍíÉ ÇÓÊáÇã åÐå ÇáãÇßíäÉ');

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'COMPLETED',
                notes: `Êã ÇáÇÓÊáÇã ãä ãÑßÒ ÇáÕíÇäÉ - ${machine.resolution || 'ÛíÑ ãÍÏÏ'}`,
                readyForPickup: machine.resolution === 'REPAIRED'
            }
        });

        await tx.machineMovementLog.create({
            data: {
                machineId: machine.id,
                serialNumber: machine.serialNumber,
                action: 'RECEIVED_FROM_CENTER',
                details: `Êã ÇáÇÓÊáÇã ÇáäåÇÆí æÇáÚãáíÉ ãßÊãáÉ`,
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
