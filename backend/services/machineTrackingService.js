const db = require('../db');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

/**
 * Get machines status for branch (track machines sent to maintenance center)
 */
async function getTrackedMachines(filters, user) {
    const originBranchId = filters.branchId || user.branchId;

    if (!originBranchId) {
        throw new Error('يرجى تحديد الفرع');
    }

    // Authorization Check
    const isPrivileged = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(user.role);
    const authorizedIds = user.authorizedBranchIds || (user.branchId ? [user.branchId] : []);

    if (!isPrivileged && !authorizedIds.includes(originBranchId)) {
        throw new Error('غير مصرح لك بمشاهدة بيانات هذا الفرع');
    }

    const where = {
        originBranchId: originBranchId,
        status: {
            in: [
                'RECEIVED_AT_CENTER',
                'ASSIGNED',
                'UNDER_INSPECTION',
                'AWAITING_APPROVAL',
                'PENDING_APPROVAL',
                'IN_PROGRESS',
                'READY_FOR_RETURN',
                'RETURNING',
                'COMPLETED',
                'IN_MAINTENANCE'
            ]
        }
    };

    if (filters.status) {
        where.status = filters.status;
    }

    // RULE 1: MUST include branchId
    const machines = await db.warehouseMachine.findMany({
        where: {
            ...where,
            branchId: { not: null }
        },
        include: {
            currentAssignment: {
                include: {
                    logs: {
                        orderBy: { performedAt: 'desc' },
                        take: 3
                    }
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    return machines.map(m => {
        const assignment = m.currentAssignment || {};
        return {
            id: assignment.id || m.id,
            serialNumber: m.serialNumber,
            status: m.status,
            technicianName: m.currentTechnicianName || 'قيد الانتظار',
            customerName: m.customerName,
            totalCost: assignment.totalCost || 0,
            assignedAt: assignment.assignedAt || m.updatedAt,
            startedAt: assignment.startedAt,
            completedAt: assignment.completedAt,
            rejectionFlag: false,
            machine: {
                model: m.model,
                manufacturer: m.manufacturer
            },
            logs: assignment.logs || []
        };
    });
}

/**
 * Get summary of machines at maintenance center
 */
async function getTrackingSummary(filters, user) {
    const originBranchId = filters.branchId || user.branchId;

    if (!originBranchId) {
        throw new Error('يرجى تحديد الفرع');
    }

    // Authorization Check
    const isPrivileged = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(user.role);
    const authorizedIds = user.authorizedBranchIds || (user.branchId ? [user.branchId] : []);

    if (!isPrivileged && !authorizedIds.includes(originBranchId)) {
        throw new Error('غير مصرح لك بمشاهدة بيانات هذا الفرع');
    }

    // RULE 1: MUST include branchId
    const statuses = await db.warehouseMachine.groupBy({
        by: ['status'],
        where: {
            originBranchId,
            branchId: { not: null },
            status: {
                in: [
                    'RECEIVED_AT_CENTER',
                    'ASSIGNED',
                    'UNDER_INSPECTION',
                    'AWAITING_APPROVAL',
                    'PENDING_APPROVAL',
                    'IN_PROGRESS',
                    'READY_FOR_RETURN',
                    'RETURNING',
                    'COMPLETED',
                    'IN_MAINTENANCE'
                ]
            }
        },
        _count: { id: true }
    });

    const summary = {
        total: 0,
        assigned: 0,
        inProgress: 0,
        pendingApproval: 0,
        approved: 0,
        rejected: 0,
        completed: 0,
        received: 0
    };

    statuses.forEach(s => {
        summary.total += s._count.id;
        const count = s._count.id;
        switch (s.status) {
            case 'RECEIVED_AT_CENTER': summary.received += count; break;
            case 'ASSIGNED': summary.assigned += count; break;
            case 'IN_PROGRESS':
            case 'IN_MAINTENANCE':
            case 'UNDER_INSPECTION':
                summary.inProgress += count;
                break;
            case 'PENDING_APPROVAL':
            case 'AWAITING_APPROVAL':
                summary.pendingApproval += count;
                break;
            case 'APPROVED': summary.approved += count; break;
            case 'REJECTED': summary.rejected += count; break;
            case 'COMPLETED':
            case 'READY_FOR_RETURN':
                summary.completed += count;
                break;
        }
    });

    return summary;
}

/**
 * Get single machine tracking info
 */
async function getMachineTrackingInfo(serialNumber, user) {
    // RULE 1: MUST include branchId
    const assignment = await db.serviceAssignment.findFirst({
        where: {
            serialNumber,
            branchId: { not: null }
        },
        include: {
            machine: true,
            logs: {
                orderBy: { performedAt: 'desc' }
            }
        },
        orderBy: { assignedAt: 'desc' }
    });

    return assignment;
}

module.exports = {
    getTrackedMachines,
    getTrackingSummary,
    getMachineTrackingInfo
};
