const db = require('../db');
const movementService = require('./movementService');
const { detectMachineParams } = require('../utils/machine-validation');

async function importMachines(machines, branchId, performedBy = 'System') {
    if (!Array.isArray(machines)) {
        const err = new Error('machines must be an array');
        err.status = 400;
        throw err;
    }

    if (!branchId) {
        const err = new Error('Branch ID is required for import');
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
                    throw new Error(`Machine exists in another branch (${existing.branchId})`);
                }

                if (existing.status !== machine.status) {
                    await movementService.logMachineMovement(db, { machineId: existing.id, serialNumber: existing.serialNumber, action: 'STATUS_CHANGE', details: `Changed from ${existing.status} to ${machine.status} via Import`, performedBy, branchId: existing.branchId });
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
                        throw new Error(`ظ…ط§ظƒظٹظ†ط© ظ…ط³ط¬ظ„ط© ظ„ط¯ظ‰ ط¹ظ…ظٹظ„ ظپظٹ ظپط±ط¹ "${branchName}"`);
                    }
                    throw new Error(`ظ…ط§ظƒظٹظ†ط© ظ…ط³ط¬ظ„ط© ظ„ط¯ظ‰ ط¹ظ…ظٹظ„ (${existsWithCustomer.customer?.name || existsWithCustomer.customerId})`);
                }

                const detectedParams = detectMachineParams(serialNumber, machineParams);
                const finalModel = machine.model ? String(machine.model) : detectedParams.model;
                const finalManufacturer = machine.manufacturer ? String(machine.manufacturer) : detectedParams.manufacturer;

                const newMachine = await db.warehouseMachine.create({ data: { branchId, serialNumber, model: finalModel, manufacturer: finalManufacturer, status: machine.status || 'NEW', notes: machine.notes ? String(machine.notes) : null } });

                await movementService.logMachineMovement(db, { machineId: newMachine.id, serialNumber: newMachine.serialNumber, action: 'IMPORT', details: `Imported with status ${machine.status} to branch ${branchId}`, performedBy, branchId });
                results.success++;
            }
        } catch (err) {
            results.failed++;
            results.errors.push({ serial: machine.serialNumber, error: err.message });
        }
    }

    return results;
}

async function createMachine(data, user) {
    const branchId = user.branchId || data.branchId;
    if (!branchId) {
        const err = new Error('Branch ID Missing');
        err.status = 400;
        throw err;
    }

    const existsWithCustomer = await db.posMachine.findFirst({
        where: { serialNumber: data.serialNumber, branchId: { not: null } }
    });
    if (existsWithCustomer) {
        const err = new Error(`Machine exists with customer ${existsWithCustomer.customerId}`);
        err.status = 400;
        throw err;
    }

    const existing = await db.warehouseMachine.findFirst({
        where: { serialNumber: data.serialNumber, branchId: { not: null } }
    });
    if (existing) {
        const err = new Error(`Machine exists in warehouse (ID: ${existing.id})`);
        err.status = 400;
        throw err;
    }

    const machine = await db.warehouseMachine.create({ data: { ...data, branchId } });

    await movementService.logMachineMovement(db, { machineId: machine.id, serialNumber: machine.serialNumber, action: 'CREATE', details: `Manually added with status ${machine.status} to branch ${branchId}`, performedBy: data.performedBy || user.displayName || 'System', branchId });

    return machine;
}

// Export new function
module.exports = { importMachines, createMachine };
