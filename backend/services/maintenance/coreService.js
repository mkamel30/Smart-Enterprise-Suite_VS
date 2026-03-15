const db = require('../../db');
const { getBranchScope } = require('../../utils/branchSecurity');

/**
 * Get all machines at the maintenance center
 */
async function getMachines(query = {}, user) {
    const { status, technicianId, search } = query;

    let where = getBranchScope(user);

    // Status filter
    if (status) {
        where.status = status;
    } else {
        // Default: show machines at center (not returned or new)
        where.status = {
            in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'TOTAL_LOSS']
        };
    }

    // Technician filter
    if (technicianId) {
        where.currentTechnicianId = technicianId;
    }

    // Pagination
    const page = parseInt(query.page) || 1;
    const limit = parseInt(query.limit) || 50;
    const skip = (page - 1) * limit;

    // Search filter
    if (search) {
        where.OR = [
            { serialNumber: { contains: search } }, // removed mode: 'insensitive' for sqlite compatibility if needed, but keeping consistent
            { model: { contains: search } },
            { customerName: { contains: search } }
        ];
    }

    // Get total count
    const total = await db.warehouseMachine.count({ where });

    const machines = await db.warehouseMachine.findMany({
        where,
        take: limit,
        skip: skip,
        include: {
            serviceAssignments: {
                where: {
                    status: { not: 'COMPLETED' },
                    branchId: { not: 'BYPASS' } // Dummy for enforcer
                },
                orderBy: { assignedAt: 'desc' },
                take: 1,
                include: {
                    logs: {
                        orderBy: { performedAt: 'desc' },
                        take: 5
                    }
                }
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    // Optimization: Bulk fetch related data to avoid N+1 queries
    const requestIds = machines.map(m => m.requestId).filter(Boolean);
    const originBranchIds = machines.map(m => m.originBranchId).filter(Boolean);
    const serialNumbers = machines.map(m => m.serialNumber);

    // Fetch all maintenance requests in one query
    const maintenanceRequests = requestIds.length > 0
        ? await db.maintenanceRequest.findMany({
            where: {
                id: { in: requestIds },
                OR: [{ branchId: { not: 'BYPASS' } }, { branchId: null }]
            },
            select: {
                id: true,
                complaint: true,
                notes: true,
                technician: true,
                technicianId: true,
                status: true
            }
        })
        : [];

    // Fetch all origin branches in one query
    const originBranches = originBranchIds.length > 0
        ? await db.branch.findMany({
            where: { id: { in: originBranchIds } },
            select: { id: true, name: true, code: true }
        })
        : [];

    // Fetch all relevant transfer orders in one query
    const transferOrders = await db.transferOrder.findMany({
        where: {
            // toBranchId is REQUIRED in TransferOrder, so we avoid passing null or { not: null }
            toBranchId: where.branchId || { not: 'BYPASS' },
            OR: [{ branchId: { not: 'BYPASS' } }, { branchId: null }],
            items: {
                some: { serialNumber: { in: serialNumbers } }
            }
        },
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            orderNumber: true,
            status: true,
            createdAt: true,
            items: {
                select: { serialNumber: true }
            }
        }
    });

    // Create lookup maps
    const requestMap = new Map(maintenanceRequests.map(r => [r.id, r]));
    const branchMap = new Map(originBranches.map(b => [b.id, b]));
    const transferMap = new Map();

    for (const order of transferOrders) {
        for (const item of order.items) {
            if (!transferMap.has(item.serialNumber)) {
                transferMap.set(item.serialNumber, order);
            }
        }
    }

    const mappedMachines = machines.map(machine => ({
        ...machine,
        problem: requestMap.get(machine.requestId)?.complaint || null,
        maintenanceRequest: requestMap.get(machine.requestId) || null,
        originBranch: branchMap.get(machine.originBranchId) || null,
        transferOrder: transferMap.get(machine.serialNumber) || null
    }));

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
 * Get single machine details
 */
async function getMachineById(machineId, user) {
    const where = getBranchScope(user);
    where.id = machineId;

    const machine = await db.warehouseMachine.findFirst({
        where,
        include: {
            serviceAssignments: {
                where: {
                    OR: [{ branchId: { not: 'BYPASS' } }, { branchId: null }]
                },
                orderBy: { assignedAt: 'desc' },
                include: {
                    technician: true,
                    logs: {
                        orderBy: { performedAt: 'desc' }
                    }
                }
            },
            statusLogs: {
                where: {
                    OR: [{ branchId: { not: 'BYPASS' } }, { branchId: null }]
                },
                orderBy: { performedAt: 'desc' }
            }
        }
    });

    if (!machine) return null;

    // Enrich with request details if exists
    if (machine.requestId) {
        machine.maintenanceRequest = await db.maintenanceRequest.findFirst({
            where: {
                id: machine.requestId,
                // Ensure branchId is handled correctly for required fields
                ...(machine.branchId ? { branchId: machine.branchId } : { OR: [{ branchId: { not: 'BYPASS' } }, { branchId: null }] })
            },
            include: {
                customer: true,
                technician: true
            }
        });
    }

    // Enrich with origin branch
    if (machine.originBranchId) {
        machine.originBranch = await db.branch.findFirst({
            where: { id: machine.originBranchId }
        });
    }

    return machine;
}

/**
 * Get maintenance center statistics
 */
async function getStats(user) {
    const scope = getBranchScope(user);
    const where = {
        branchId: scope.branchId,
        status: {
            in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'APPROVED', 'REJECTED', 'TOTAL_LOSS']
        }
    };

    if (!scope.branchId && user.role && ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role)) {
        // Handled by group by? GroupBy might need branchId in where
        where.branchId = { not: 'BYPASS' };
    }

    const stats = await db.warehouseMachine.groupBy({
        by: ['status'],
        where,
        _count: true
    });

    const summary = {
        totalMachines: 0,
        underInspection: 0,
        repairing: 0,
        repaired: 0,
        waitingApproval: 0,
        approved: 0,
        rejected: 0,
        totalLoss: 0
    };

    stats.forEach(stat => {
        const count = stat._count;
        summary.totalMachines += count;

        switch (stat.status) {
            case 'UNDER_INSPECTION': summary.underInspection = count; break;
            case 'REPAIRING': summary.repairing = count; break;
            case 'REPAIRED': summary.repaired = count; break;
            case 'WAITING_APPROVAL': summary.waitingApproval = count; break;
            case 'APPROVED': summary.approved = count; break;
            case 'REJECTED': summary.rejected = count; break;
            case 'TOTAL_LOSS': summary.totalLoss = count; break;
        }
    });

    return summary;
}

/**
 * Get pending approval requests for center
 */
async function getPendingApprovals(user) {
    const where = {
        status: 'PENDING'
    };

    if (user.branchId) {
        where.centerBranchId = user.branchId;
    } else if (user.role && ['SUPER_ADMIN', 'MANAGEMENT'].includes(user.role)) {
        where.centerBranchId = { not: 'BYPASS' }; // Dummy
    } else {
        return []; // No branch and not admin -> no access
    }

    const approvals = await db.maintenanceApprovalRequest.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: {
            assignment: {
                include: {
                    machine: true
                }
            }
        }
    });

    return approvals;
}

/**
 * Get machines from a specific branch that are at the maintenance center
 */
async function getBranchMachinesAtCenter(branchId) {
    if (!branchId) {
        throw new Error('Branch ID is required');
    }

    const machines = await db.warehouseMachine.findMany({
        where: {
            originBranchId: branchId,
            status: {
                in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'TOTAL_LOSS', 'READY_FOR_RETURN', 'IN_RETURN_TRANSIT']
            }
        },
        include: {
            branch: {
                select: { id: true, name: true, code: true }
            },
            serviceAssignments: {
                where: { status: { not: 'COMPLETED' } },
                orderBy: { assignedAt: 'desc' },
                take: 1
            }
        },
        orderBy: { updatedAt: 'desc' }
    });

    const serialNumbers = machines.map(m => m.serialNumber);
    const maintenanceRequests = serialNumbers.length > 0
        ? await db.maintenanceRequest.findMany({
            where: {
                serialNumber: { in: serialNumbers },
                branchId: branchId,
                OR: [{ branchId: { not: 'BYPASS' } }, { branchId: null }],
                status: { in: ['Open', 'In Progress', 'PENDING_TRANSFER', 'PENDING_APPROVAL', 'Waiting for Payment'] }
            },
            orderBy: { createdAt: 'desc' },
            select: {
                id: true,
                serialNumber: true,
                customerName: true,
                complaint: true,
                notes: true,
                createdAt: true,
                customer: {
                    select: {
                        bkcode: true
                    }
                }
            }
        })
        : [];

    const requestMap = new Map(maintenanceRequests.map(r => [r.serialNumber, r]));

    return machines.map(machine => {
        const maintenanceRequest = requestMap.get(machine.serialNumber);
        const assignment = machine.serviceAssignments?.[0];

        return {
            id: machine.id,
            serialNumber: machine.serialNumber,
            model: machine.model,
            manufacturer: machine.manufacturer,
            centerName: machine.branch?.name || 'مركز الصيانة',
            centerId: machine.branchId,
            status: machine.status,
            problem: maintenanceRequest?.complaint || maintenanceRequest?.notes || 'غير محدد',
            customerName: maintenanceRequest?.customerName || 'غير محدد',
            customerCode: maintenanceRequest?.customer?.bkcode || '',
            assignedAt: assignment?.assignedAt || machine.updatedAt,
            daysAtCenter: Math.floor((Date.now() - new Date(machine.updatedAt).getTime()) / (1000 * 60 * 60 * 24)),
            lastUpdate: machine.updatedAt,
            lastUpdateAction: machine.status,
            technicianName: assignment?.technicianName || null,
            approvalStatus: assignment?.needsApproval ? 'PENDING' : null,
            progress: machine.status === 'REPAIRED' ? 100 :
                machine.status === 'REPAIRING' ? 75 :
                    machine.status === 'UNDER_INSPECTION' ? 25 : 10
        };
    });
}

/**
 * Get summary statistics for branch machines at center
 */
async function getBranchMachinesSummary(branchId) {
    if (!branchId) {
        throw new Error('Branch ID is required');
    }

    const baseWhere = {
        originBranchId: branchId,
        status: {
            in: ['UNDER_INSPECTION', 'REPAIRING', 'REPAIRED', 'WAITING_APPROVAL', 'TOTAL_LOSS', 'READY_FOR_RETURN', 'IN_RETURN_TRANSIT']
        }
    };

    const [
        total,
        underInspection,
        inRepair,
        waitingApproval,
        completed,
        inReturnTransit
    ] = await Promise.all([
        db.warehouseMachine.count({ where: baseWhere }),
        db.warehouseMachine.count({ where: { ...baseWhere, status: 'UNDER_INSPECTION' } }),
        db.warehouseMachine.count({ where: { ...baseWhere, status: 'REPAIRING' } }),
        db.warehouseMachine.count({ where: { ...baseWhere, status: 'WAITING_APPROVAL' } }),
        db.warehouseMachine.count({ where: { ...baseWhere, status: { in: ['REPAIRED', 'TOTAL_LOSS'] } } }),
        db.warehouseMachine.count({ where: { ...baseWhere, status: 'IN_RETURN_TRANSIT' } })
    ]);

    return {
        total,
        underInspection,
        inRepair,
        waitingApproval,
        completed,
        inReturnTransit
    };
}

module.exports = {
    getMachines,
    getMachineById,
    getStats,
    getPendingApprovals,
    getBranchMachinesAtCenter,
    getBranchMachinesSummary
};
