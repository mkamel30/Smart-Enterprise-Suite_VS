const db = require('../../db');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError, ConflictError } = require('../../utils/errors');
const { createNotification } = require('../../routes/notifications');
const { getBranchScope } = require('../../utils/branchSecurity');

/**
 * Generate unique voucher code
 */
async function generateVoucherCode(tx) {
    const today = new Date();
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');

    const lastVoucher = await tx.repairVoucher.findFirst({
        where: {
            code: { startsWith: `RV-${dateStr}` }
        },
        orderBy: { code: 'desc' }
    });

    let seq = 1;
    if (lastVoucher) {
        const parts = lastVoucher.code.split('-');
        seq = parseInt(parts[2] || '0') + 1;
    }

    return `RV-${dateStr}-${seq.toString().padStart(4, '0')}`;
}

/**
 * Assign technician to machine
 */
async function assignTechnician(machineId, { technicianId, technicianName }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    const result = await db.$transaction(async (tx) => {
        // Update machine
        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                currentTechnicianId: technicianId,
                currentTechnicianName: technicianName,
                status: machine.status === 'NEW' ? 'UNDER_INSPECTION' : machine.status,
                updatedAt: new Date()
            }
        });

        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                branchId: machine.branchId,
                status: { notIn: ['COMPLETED', 'RETURNED'] }
            }
        });

        if (assignment) {
            await tx.serviceAssignment.updateMany({
                where: { id: assignment.id, branchId: machine.branchId },
                data: {
                    technicianId,
                    technicianName
                }
            });
        } else {
            assignment = await tx.serviceAssignment.create({
                data: {
                    machineId,
                    serialNumber: machine.serialNumber,
                    technicianId,
                    technicianName,
                    customerId: machine.customerId,
                    customerName: machine.customerName,
                    customerBkcode: machine.customerBkcode,
                    requestId: machine.requestId,
                    branchId: machine.branchId,
                    originBranchId: machine.originBranchId || machine.branchId,
                    centerBranchId: machine.branchId,
                    status: 'UNDER_INSPECTION'
                }
            });
        }

        await tx.serviceAssignmentLog.create({
            data: {
                assignmentId: assignment.id,
                action: 'ASSIGNED',
                details: `تم تعيين ${technicianName} للماكينة ${machine.serialNumber}`,
                performedBy: user.displayName || user.email,
                performedById: user.id
            }
        });

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'TECHNICIAN_ASSIGNED',
                details: JSON.stringify({ technicianId, technicianName }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        return await tx.serviceAssignment.findFirst({
            where: { id: assignment.id, branchId: machine.branchId },
            include: { machine: true }
        });
    });

    if (technicianId !== user.id) {
        await createNotification({
            userId: technicianId,
            branchId: machine.branchId,
            type: 'ASSIGNMENT',
            title: 'تعيين جديد',
            message: `تم تعيينك لصيانة الماكينة ${machine.serialNumber}`,
            link: '/maintenance-center'
        });
    }

    return result;
}

/**
 * Perform initial inspection on machine
 */
async function inspectMachine(machineId, { problemDescription, estimatedCost, requiredParts }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    const result = await db.$transaction(async (tx) => {
        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                proposedRepairNotes: problemDescription,
                proposedTotalCost: estimatedCost || 0,
                proposedParts: requiredParts ? JSON.stringify(requiredParts) : null,
                status: 'UNDER_INSPECTION',
                updatedAt: new Date()
            }
        });

        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                branchId: machine.branchId,
                status: { notIn: ['COMPLETED', 'RETURNED'] }
            }
        });

        if (assignment) {
            await tx.serviceAssignment.updateMany({
                where: { id: assignment.id, branchId: machine.branchId },
                data: {
                    proposedParts: requiredParts ? JSON.stringify(requiredParts) : null,
                    proposedTotal: estimatedCost || 0
                }
            });

            await tx.serviceAssignmentLog.create({
                data: {
                    assignmentId: assignment.id,
                    action: 'INSPECTED',
                    details: `تم الفحص - ${problemDescription}`,
                    performedBy: user.displayName || user.email,
                    performedById: user.id
                }
            });
        }

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'INSPECTION_COMPLETED',
                details: JSON.stringify({
                    problemDescription,
                    estimatedCost,
                    requiredParts,
                    approvalRequired: false
                }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        return {
            machine: await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: machine.branchId } }),
            assignment,
            approvalRequest: null
        };
    });

    return result;
}

/**
 * Start repair on machine
 */
async function startRepair(machineId, { repairType, parts, cost }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    const validTypes = ['FREE_NO_PARTS', 'FREE_WITH_PARTS', 'PAID_WITH_PARTS'];
    if (!validTypes.includes(repairType)) {
        throw new ValidationError(`Invalid repair type. Must be one of: ${validTypes.join(', ')}`);
    }

    const result = await db.$transaction(async (tx) => {
        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                branchId: machine.branchId,
                status: { notIn: ['COMPLETED', 'RETURNED'] }
            }
        });

        if (!assignment) {
            throw new ConflictError('No active service assignment found for this machine');
        }

        if (parts && parts.length > 0) {
            for (const part of parts) {
                const inventoryItem = await tx.inventoryItem.findFirst({
                    where: {
                        partId: part.partId,
                        branchId: machine.branchId
                    }
                });

                if (!inventoryItem || inventoryItem.quantity < part.quantity) {
                    throw new ConflictError(
                        `Insufficient stock for part ${part.name}. Available: ${inventoryItem?.quantity || 0}, Required: ${part.quantity}`
                    );
                }

                await tx.inventoryItem.updateMany({
                    where: { id: inventoryItem.id, branchId: machine.branchId },
                    data: {
                        quantity: { decrement: part.quantity }
                    }
                });

                await tx.stockMovement.create({
                    data: {
                        partId: part.partId,
                        type: 'OUT',
                        quantity: part.quantity,
                        reason: `صيانة ماكينة ${machine.serialNumber}`,
                        requestId: machine.requestId,
                        performedBy: user.displayName || user.email,
                        userId: user.id,
                        branchId: machine.branchId,
                        // Use the part-specific isPaid if provided, otherwise fallback to repairType
                        isPaid: part.isPaid !== undefined ? part.isPaid : (repairType === 'PAID_WITH_PARTS')
                    }
                });
            }
        }

        await tx.serviceAssignment.updateMany({
            where: { id: assignment.id, branchId: machine.branchId },
            data: {
                usedParts: parts ? JSON.stringify(parts) : null,
                totalCost: cost || 0,
                status: 'IN_PROGRESS'
            }
        });

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'REPAIRING',
                usedParts: parts ? JSON.stringify(parts) : null,
                totalCost: cost || 0,
                updatedAt: new Date()
            }
        });

        await tx.serviceAssignmentLog.create({
            data: {
                assignmentId: assignment.id,
                action: 'REPAIR_STARTED',
                details: `بدء الصيانة - النوع: ${repairType}${parts ? ' - قطع: ' + parts.map(p => p.name).join('، ') : ''}`,
                performedBy: user.displayName || user.email,
                performedById: user.id
            }
        });

        let debtRecord = null;
        if (repairType === 'PAID_WITH_PARTS' && cost > 0) {
            debtRecord = await tx.branchDebt.create({
                data: {
                    type: 'MAINTENANCE',
                    referenceId: assignment.id,
                    machineSerial: machine.serialNumber,
                    customerId: machine.customerId || '',
                    customerName: machine.customerName || '',
                    amount: cost,
                    remainingAmount: cost,
                    partsDetails: parts ? JSON.stringify(parts) : '[]',
                    creditorBranchId: machine.branchId,
                    debtorBranchId: machine.originBranchId || machine.branchId,
                    status: 'PENDING'
                }
            });
        }

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'REPAIR_STARTED',
                details: JSON.stringify({
                    repairType,
                    parts,
                    cost,
                    debtCreated: !!debtRecord
                }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        return {
            machine: await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: machine.branchId } }),
            assignment: await tx.serviceAssignment.findFirst({ where: { id: assignment.id, branchId: machine.branchId } }),
            debtRecord
        };
    });

    return result;
}

/**
 * Request approval from branch for costly repairs
 */
async function requestApproval(machineId, { cost, parts, notes }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    const result = await db.$transaction(async (tx) => {
        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                branchId: machine.branchId,
                status: { notIn: ['COMPLETED', 'RETURNED'] }
            }
        });

        if (!assignment) {
            throw new ConflictError('No active service assignment found for this machine');
        }

        const approvalRequest = await tx.maintenanceApprovalRequest.create({
            data: {
                assignmentId: assignment.id,
                machineSerial: machine.serialNumber,
                customerId: machine.customerId || '',
                customerName: machine.customerName || '',
                proposedParts: JSON.stringify(parts || []),
                proposedTotal: cost,
                diagnosis: notes,
                centerBranchId: machine.branchId,
                originBranchId: machine.originBranchId || machine.branchId
            }
        });

        await tx.serviceAssignment.updateMany({
            where: { id: assignment.id, branchId: machine.branchId },
            data: {
                status: 'WAITING_APPROVAL',
                needsApproval: true,
                proposedParts: JSON.stringify(parts || []),
                proposedTotal: cost
            }
        });

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'WAITING_APPROVAL',
                proposedParts: JSON.stringify(parts || []),
                proposedTotalCost: cost,
                proposedRepairNotes: notes
            }
        });

        await tx.serviceAssignmentLog.create({
            data: {
                assignmentId: assignment.id,
                action: 'APPROVAL_REQUESTED',
                details: `طلب موافقة بقيمة ${cost} ج.م - ${notes || ''}`,
                performedBy: user.displayName || user.email,
                performedById: user.id
            }
        });

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'APPROVAL_REQUESTED',
                details: JSON.stringify({ cost, parts, notes }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        return {
            machine: await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: machine.branchId } }),
            assignment: await tx.serviceAssignment.findFirst({ where: { id: assignment.id, branchId: machine.branchId } }),
            approvalRequest
        };
    });

    const partsList = parts ? parts.map(p => p.name).join('، ') : '';
    await createNotification({
        branchId: machine.originBranchId || machine.branchId,
        type: 'APPROVAL_REQUEST',
        title: '⚠️ طلب موافقة صيانة',
        message: `الماكينة ${machine.serialNumber} تحتاج موافقة بقيمة ${cost} ج.م${partsList ? ' - القطع: ' + partsList : ''}`,
        link: '/maintenance-approvals',
        data: JSON.stringify({ machineId, serialNumber: machine.serialNumber })
    });

    return result;
}

/**
 * Mark machine as repaired
 */
async function markRepaired(machineId, { repairNotes, actionTaken }, user) {
    const where = { id: machineId, ...getBranchScope(user) };

    const machine = await db.warehouseMachine.findFirst({ where });

    if (!machine) {
        throw new NotFoundError('Machine not found');
    }

    const result = await db.$transaction(async (tx) => {
        let assignment = await tx.serviceAssignment.findFirst({
            where: {
                machineId,
                branchId: machine.branchId,
                status: { notIn: ['COMPLETED', 'RETURNED'] }
            }
        });

        if (!assignment) {
            throw new ConflictError('No active service assignment found for this machine');
        }

        if (assignment.needsApproval && assignment.proposedTotal > 0) {
            const pendingApproval = await tx.maintenanceApprovalRequest.findFirst({
                where: {
                    assignmentId: assignment.id,
                    centerBranchId: machine.branchId,
                    status: 'PENDING'
                }
            });

            if (pendingApproval) {
                throw new ConflictError('Cannot mark as repaired: approval request is still pending');
            }
        }

        const voucherCode = await generateVoucherCode(tx);

        const voucher = await tx.repairVoucher.create({
            data: {
                code: voucherCode,
                requestId: machine.requestId || assignment.requestId || machineId,
                type: 'REPAIR',
                parts: assignment.usedParts || '[]',
                totalCost: assignment.totalCost || 0,
                branchId: machine.branchId,
                createdBy: user.displayName || user.email
            }
        });

        await tx.serviceAssignment.updateMany({
            where: { id: assignment.id, branchId: machine.branchId },
            data: {
                status: 'COMPLETED',
                actionTaken: actionTaken || 'REPAIRED',
                resolution: 'REPAIRED',
                completedAt: new Date()
            }
        });

        await tx.warehouseMachine.updateMany({
            where: { id: machineId, branchId: machine.branchId },
            data: {
                status: 'REPAIRED',
                repairNotes: repairNotes || null,
                resolution: 'REPAIRED',
                updatedAt: new Date()
            }
        });

        await tx.serviceAssignmentLog.create({
            data: {
                assignmentId: assignment.id,
                action: 'COMPLETED',
                details: `تم إكمال الصيانة - ${actionTaken || 'REPAIRED'} - سند: ${voucherCode}`,
                performedBy: user.displayName || user.email,
                performedById: user.id
            }
        });

        await tx.systemLog.create({
            data: {
                entityType: 'WAREHOUSE_MACHINE',
                entityId: machine.serialNumber,
                action: 'REPAIR_COMPLETED',
                details: JSON.stringify({
                    voucherCode,
                    actionTaken,
                    repairNotes,
                    totalCost: assignment.totalCost
                }),
                performedBy: user.displayName || user.email,
                userId: user.id,
                branchId: machine.branchId
            }
        });

        // Create UsedPartLog for Technician Consumption Reports
        if (assignment.usedParts && assignment.usedParts !== '[]') {
            await tx.usedPartLog.create({
                data: {
                    requestId: assignment.requestId || machine.requestId || machine.id,
                    customerId: machine.customerId || assignment.customerId || '',
                    customerName: machine.customerName || assignment.customerName || 'عميل المركز',
                    posMachineId: machine.id,
                    technician: assignment.technicianName,
                    closedByUserId: user.id,
                    closedAt: new Date(),
                    parts: assignment.usedParts, // Already JSON string
                    receiptNumber: voucherCode,
                    branchId: machine.branchId
                }
            });
        }

        return {
            machine: await tx.warehouseMachine.findFirst({ where: { id: machineId, branchId: machine.branchId } }),
            assignment: await tx.serviceAssignment.findFirst({
                where: { id: assignment.id, branchId: machine.branchId },
                include: { logs: true }
            }),
            voucher
        };
    });

    await createNotification({
        branchId: machine.originBranchId || machine.branchId,
        type: 'REPAIR_COMPLETED',
        title: '✅ تم إصلاح الماكينة',
        message: `تم إصلاح الماكينة ${machine.serialNumber} بنجاح ورقم السند ${result.voucher.code}`,
        link: `/maintenance-center/${machineId}`
    });

    return result;
}

module.exports = {
    assignTechnician,
    inspectMachine,
    startRepair,
    requestApproval,
    markRepaired
};
