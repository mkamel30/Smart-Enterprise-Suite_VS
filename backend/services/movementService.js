const db = require('../db');

/**
 * Service to handle all inventory movement logging centrally
 */
const movementService = {
    /**
     * Log a machine movement
     */
    async logMachineMovement(tx, {
        machineId,
        serialNumber,
        action,
        details,
        performedBy,
        branchId,
        fromBranchId = null,
        customerId = null
    }) {
        return await (tx || db).machineMovementLog.create({
            data: {
                machineId,
                serialNumber,
                action,
                details: typeof details === 'object' ? JSON.stringify({ ...details, fromBranchId, customerId }) : JSON.stringify({ message: details, fromBranchId, customerId }),
                performedBy: performedBy || 'System',
                branchId
            }
        });
    },

    /**
     * Log a SIM card movement
     */
    async logSimMovement(tx, {
        simId,
        serialNumber,
        action,
        details,
        performedBy,
        branchId,
        fromBranchId = null,
        customerId = null
    }) {
        return await (tx || db).simMovementLog.create({
            data: {
                simId,
                serialNumber,
                action,
                details: typeof details === 'object' ? JSON.stringify({ ...details, fromBranchId, customerId }) : JSON.stringify({ message: details, fromBranchId, customerId }),
                performedBy: performedBy || 'System',
                branchId
            }
        });
    },

    /**
     * Create a general system audit log
     */
    async logSystemAction(tx, {
        entityType,
        entityId,
        action,
        details,
        userId,
        performedBy,
        branchId
    }) {
        return await (tx || db).systemLog.create({
            data: {
                entityType,
                entityId,
                action,
                details: typeof details === 'object' ? JSON.stringify(details) : details,
                userId,
                performedBy,
                branchId
            }
        });
    }
};

module.exports = movementService;
