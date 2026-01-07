const db = require('../db');

/**
 * Exchange machine between customer and warehouse
 * @param {String} customerId - Customer ID
 * @param {String} oldSerial - Old machine serial number
 * @param {String} newSerial - New machine serial number
 * @param {String} newStatus - Status for new machine
 * @param {String} notes - Notes
 * @param {Object} user - User performing exchange
 * @returns {Promise<Object>} {oldMachine, newMachine}
 */
async function exchangeMachine(customerId, oldSerial, newSerial, newStatus, notes, user) {
    return await db.$transaction(async (tx) => {
        // 1. Get old machine
        const oldMachine = await tx.posMachine.findFirst({
            where: { serialNumber: oldSerial }
        });

        if (!oldMachine) {
            throw new Error(`الماكينة القديمة ${oldSerial} غير موجودة`);
        }

        if (oldMachine.customerId !== customerId) {
            throw new Error('الماكينة القديمة غير مسجلة لهذا العميل');
        }

        // 2. Get new machine
        const newMachine = await tx.posMachine.findFirst({
            where: { serialNumber: newSerial }
        });

        if (!newMachine) {
            throw new Error(`الماكينة الجديدة ${newSerial} غير موجودة`);
        }

        if (newMachine.customerId) {
            throw new Error('الماكينة الجديدة مسجلة لعميل آخر');
        }

        // 3. Update old machine
        const updatedOldMachine = await tx.posMachine.update({
            where: { id: oldMachine.id },
            data: {
                customerId: null,
                status: 'WAREHOUSE'
            }
        });

        // 4. Update new machine
        const updatedNewMachine = await tx.posMachine.update({
            where: { id: newMachine.id },
            data: {
                customerId: customerId,
                status: newStatus
            }
        });

        // 5. Create movement log
        await tx.machineMovementLog.create({
            data: {
                customerId: customerId,
                action: 'EXCHANGE',
                details: JSON.stringify({
                    oldMachine: {
                        serialNumber: oldMachine.serialNumber,
                        model: oldMachine.model,
                        manufacturer: oldMachine.manufacturer
                    },
                    newMachine: {
                        serialNumber: newMachine.serialNumber,
                        model: newMachine.model,
                        manufacturer: newMachine.manufacturer,
                        status: newStatus
                    },
                    notes: notes
                }),
                performedBy: user.name
            }
        });

        // 6. Log action
        await tx.systemLog.create({
            data: {
                entityType: 'MACHINE',
                entityId: newMachine.id,
                action: 'EXCHANGE',
                details: JSON.stringify({
                    customer: customerId,
                    oldSerial,
                    newSerial,
                    newStatus
                }),
                userId: user.id,
                performedBy: user.name
            }
        });

        return {
            oldMachine: updatedOldMachine,
            newMachine: updatedNewMachine
        };
    });
}

/**
 * Return machine from customer to warehouse
 * @param {String} serial - Machine serial number
 * @param {String} customerId - Customer ID
 * @param {String} reason - Return reason
 * @param {String} incomingStatus - Status (WAREHOUSE/DEFECTIVE)
 * @param {String} notes - Notes
 * @param {Object} user - User performing return
 * @returns {Promise<Object>} Updated machine
 */
async function returnMachine(serial, customerId, reason, incomingStatus, notes, user) {
    return await db.$transaction(async (tx) => {
        // 1. Get machine
        const machine = await tx.posMachine.findFirst({
            where: { serialNumber: serial }
        });

        if (!machine) {
            throw new Error(`الماكينة ${serial} غير موجودة`);
        }

        if (machine.customerId !== customerId) {
            throw new Error('الماكينة غير مسجلة لهذا العميل');
        }

        // 2. Get customer for logging
        const customer = await tx.customer.findFirst({
            where: { bkcode: customerId, branchId: user.branchId }
        });

        // 3. Update machine
        const updatedMachine = await tx.posMachine.update({
            where: { id: machine.id },
            data: {
                customerId: null,
                status: incomingStatus
            }
        });

        // 4. Create movement log
        await tx.machineMovementLog.create({
            data: {
                customerId: customerId,
                action: 'RETURN',
                details: JSON.stringify({
                    machine: {
                        serialNumber: machine.serialNumber,
                        model: machine.model,
                        manufacturer: machine.manufacturer
                    },
                    customer: {
                        client_name: customer?.client_name,
                        bkcode: customerId
                    },
                    reason: reason,
                    notes: notes
                }),
                performedBy: user.name
            }
        });

        // 5. Log action
        await tx.systemLog.create({
            data: {
                entityType: 'MACHINE',
                entityId: machine.id,
                action: 'RETURN_TO_WAREHOUSE',
                details: JSON.stringify({
                    customer: customerId,
                    machine: serial,
                    reason,
                    status: incomingStatus
                }),
                userId: user.id,
                performedBy: user.name
            }
        });

        return updatedMachine;
    });
}

module.exports = {
    exchangeMachine,
    returnMachine
};
