const db = require('../db');
const movementService = require('./movementService');
const inventoryService = require('./inventoryService');
// const notificationService = require('./notificationService'); // Assuming this exists

const MachineStatus = {
    // Logistics
    IN_TRANSIT: 'IN_TRANSIT',
    RETURNING: 'RETURNING',

    // Center Workflow
    RECEIVED_AT_CENTER: 'RECEIVED_AT_CENTER',
    ASSIGNED: 'ASSIGNED',
    UNDER_INSPECTION: 'UNDER_INSPECTION',
    AWAITING_APPROVAL: 'AWAITING_APPROVAL',
    IN_PROGRESS: 'IN_PROGRESS',
    READY_FOR_RETURN: 'READY_FOR_RETURN',

    // Outbound / Final
    COMPLETED: 'COMPLETED'
};

const Resolution = {
    REPAIRED: 'REPAIRED',
    SCRAPPED: 'SCRAPPED',
    REJECTED_REPAIR: 'REJECTED_REPAIR'
};

/**
 * Machine State Service
 * Centralizes all logic for moving machines between statuses.
 */
class MachineStateService {

    // Define Valid Transitions
    static VALID_TRANSITIONS = {
        [MachineStatus.IN_TRANSIT]: [MachineStatus.RECEIVED_AT_CENTER],

        [MachineStatus.RECEIVED_AT_CENTER]: [
            MachineStatus.UNDER_INSPECTION,
            MachineStatus.ASSIGNED // Can assign technician directly
        ],

        [MachineStatus.ASSIGNED]: [
            MachineStatus.IN_PROGRESS,       // Tech starts work
            MachineStatus.UNDER_INSPECTION   // Tech inspects
        ],

        [MachineStatus.UNDER_INSPECTION]: [
            MachineStatus.AWAITING_APPROVAL, // Costly repair
            MachineStatus.IN_PROGRESS,       // Direct repair
            MachineStatus.READY_FOR_RETURN,  // Scrapped immediately
            MachineStatus.ASSIGNED           // Re-assign?
        ],

        [MachineStatus.AWAITING_APPROVAL]: [
            MachineStatus.IN_PROGRESS,       // Approved
            MachineStatus.READY_FOR_RETURN   // Rejected
        ],

        [MachineStatus.IN_PROGRESS]: [
            MachineStatus.READY_FOR_RETURN   // Repair done
        ],

        [MachineStatus.READY_FOR_RETURN]: [
            MachineStatus.RETURNING          // Shipped back
        ],

        [MachineStatus.RETURNING]: [
            MachineStatus.COMPLETED          // Received at branch
        ]
    };

    /**
     * Main entry point to change state
     */
    async transition(machineId, targetStatus, context = {}) {
        const { performedBy, notes, payload, branchId } = context;

        // 1. Fetch Machine
        const machine = await db.warehouseMachine.findUnique({
            where: { id: machineId },
            include: { branch: true } // To check ownership/location
        });

        if (!machine) throw new Error('Machine not found');

        // 2. Validate Transition
        // Allow Force-Transition if it's the same status (Just updating data)?
        // Or if it's a "special" logistical move managed by TransferOrders directly?
        // giving strictness:
        const currentStatus = machine.status;

        // Strict Check (Skip for IN_TRANSIT creation)
        if (currentStatus !== targetStatus &&
            !this.isValidTransition(currentStatus, targetStatus)) {

            // Allow some legacy/special bypasses if needed, or throw error
            // For now, allow "NEW/DEFECTIVE" -> "IN_TRANSIT" as legacy entry point
            const isLegacyEntry = (['NEW', 'DEFECTIVE', 'AT_CENTER', 'CLIENT_REPAIR'].includes(currentStatus)) && targetStatus === MachineStatus.IN_TRANSIT;

            if (!isLegacyEntry && targetStatus !== MachineStatus.RECEIVED_AT_CENTER) { // Start of cycle
                throw new Error(`Invalid transition from ${currentStatus} to ${targetStatus}`);
            }
        }

        // 3. Guards (Business Rules)
        await this.runGuards(machine, targetStatus, payload);

        // 4. Execution (DB Update)
        const updateData = {
            status: targetStatus,
            updatedAt: new Date()
        };

        // Handle Resolutions
        if (targetStatus === MachineStatus.READY_FOR_RETURN) {
            if (!payload?.resolution) throw new Error('Resolution is required (REPAIRED, SCRAPPED, REJECTED)');
            updateData.resolution = payload.resolution;
            updateData.notes = notes || machine.notes;
        }

        const updatedMachine = await db.warehouseMachine.update({
            where: { id: machineId },
            data: updateData
        });

        // 5. Side Effects (Actions)
        await this.runActions(updatedMachine, currentStatus, targetStatus, context);

        // 6. Log
        await movementService.logMachineMovement(db, {
            machineId: machine.id,
            serialNumber: machine.serialNumber,
            action: `TRANSITION_${targetStatus}`,
            details: {
                from: currentStatus,
                to: targetStatus,
                notes: notes,
                resolution: updateData.resolution,
                ...payload
            },
            performedBy: performedBy || 'System',
            branchId: machine.branchId
        });

        return updatedMachine;
    }

    isValidTransition(from, to) {
        return MachineStateService.VALID_TRANSITIONS[from]?.includes(to);
    }

    async runGuards(machine, target, payload) {
        // Guard: Ready for Return requires a resolution
        if (target === MachineStatus.READY_FOR_RETURN) {
            if (!payload?.resolution) {
                throw new Error('Resolution is required (REPAIRED, SCRAPPED, REJECTED)');
            }
            if (!Object.values(Resolution).includes(payload.resolution)) {
                throw new Error('Invalid Resolution Type');
            }
        }

        // Guard: Awaiting Approval should conceptually have a cost, but we allow 0 (e.g. warranty)
        // We can enforce notes if cost is 0? For now, lenient.
    }

    async runActions(machine, from, to, context) {
        const { payload, performedBy } = context;

        // Action: Create/Update Approval Record
        if (to === MachineStatus.AWAITING_APPROVAL && machine.requestId) {
            await db.maintenanceApproval.upsert({
                where: { requestId: machine.requestId },
                create: {
                    requestId: machine.requestId,
                    cost: payload?.cost || 0,
                    parts: payload?.parts || '',
                    status: 'PENDING',
                    notes: payload?.notes
                },
                update: {
                    cost: payload?.cost || 0,
                    parts: payload?.parts || '',
                    status: 'PENDING',
                    notes: payload?.notes,
                    respondedAt: null
                }
            });
        }

        // Action: Returning to customer (or branch)
        // If resolution is REPAIRED, we might want to update the Request status
        if (to === MachineStatus.READY_FOR_RETURN) {
            // Deduct parts if repair was successful and parts were provided
            if (payload?.resolution === Resolution.REPAIRED && payload?.parts && Array.isArray(payload.parts) && payload.parts.length > 0) {
                try {
                    // Map parts to the format expected by inventoryService.deductParts
                    const partsToDeduct = payload.parts.map(p => ({
                        partId: p.partId,
                        name: p.partName || p.name || 'Unknown Part',
                        quantity: p.quantity || 1,
                        reason: `Repair for Serial ${machine.serialNumber}`
                    }));

                    await inventoryService.deductParts(
                        partsToDeduct,
                        machine.requestId || `MCH-${machine.id}`, // Use machine ID if no request link
                        performedBy || 'System',
                        machine.branchId,
                        context.tx // Pass transaction if available
                    );
                } catch (err) {
                    console.error('Failed to deduct parts during transition:', err);
                    // We might not want to block the transition if inventory fails? 
                    // Actually, the implementation plan implies it should be accurate.
                    // But in runActions, it's safer to either throw or log.
                    // If we throw, the whole transition fails (transactional).
                    throw err;
                }
            }

            // Sync with Maintenance Request if exists
            if (machine.requestId) {
                // Update request notes or technicalStatus if needed
            }
        }
    }

    // Simplified getter for Kanban Columns
    async getKanbanStats(branchId) {
        const relevantStatuses = [
            MachineStatus.RECEIVED_AT_CENTER,
            MachineStatus.UNDER_INSPECTION,
            MachineStatus.AWAITING_APPROVAL,
            MachineStatus.IN_PROGRESS,
            MachineStatus.READY_FOR_RETURN
        ];

        const counts = await db.warehouseMachine.groupBy({
            by: ['status'],
            where: {
                status: { in: relevantStatuses },
                ...(branchId ? { branchId } : {})
            },
            _count: {
                _all: true
            }
        });

        const result = {};
        relevantStatuses.forEach(s => result[s] = 0);
        counts.forEach(c => {
            result[c.status] = c._count._all;
        });
        return result;
    }
}

module.exports = new MachineStateService();
module.exports.MachineStatus = MachineStatus;
module.exports.Resolution = Resolution;
