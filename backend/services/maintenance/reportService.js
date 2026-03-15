const db = require('../../db');

/**
 * Maintenance Performance Report Service
 * Contains logic for calculating various maintenance metrics
 */

async function calculateRequestMetrics(branchCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer) {
    const byStatus = await db.maintenanceRequest.groupBy({
        by: ['status'],
        where: { ...branchCondition, ...dateCondition },
        _count: { id: true }
    });

    const statusMap = {};
    let total = 0;
    byStatus.forEach(s => {
        statusMap[s.status] = s._count.id;
        total += s._count.id;
    });

    const closedRequests = await db.maintenanceRequest.findMany({
        where: {
            ...branchCondition,
            status: 'Closed',
            closingTimestamp: { gte: rangeStart, lte: rangeEnd },
            ...skipEnforcer
        },
        select: { createdAt: true, closingTimestamp: true }
    });

    let avgTimeToCompletion = 0;
    let onTimeCount = 0;
    const targetHours = 48;

    if (closedRequests.length > 0) {
        const totalHours = closedRequests.reduce((sum, r) => {
            const hours = (new Date(r.closingTimestamp) - new Date(r.createdAt)) / (1000 * 60 * 60);
            if (hours <= targetHours) onTimeCount++;
            return sum + hours;
        }, 0);
        avgTimeToCompletion = Math.round(totalHours / closedRequests.length * 10) / 10;
    }

    const onTimeRate = closedRequests.length > 0
        ? Math.round((onTimeCount / closedRequests.length) * 100)
        : 0;

    const pendingApproval = await db.maintenanceRequest.count({
        where: {
            ...branchCondition,
            status: { in: ['Pending Approval', 'AWAITING_APPROVAL'] },
            ...skipEnforcer
        }
    });

    return {
        total,
        byStatus: statusMap,
        avgTimeToCompletionHours: avgTimeToCompletion,
        avgTimeToCompletionDays: Math.round(avgTimeToCompletion / 24 * 10) / 10,
        onTimeRate,
        delayedRate: 100 - onTimeRate,
        pendingApproval,
        closedThisPeriod: closedRequests.length
    };
}

async function calculateTechnicianMetrics(branchCondition, dateCondition, targetBranchId) {
    const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};
    const assignmentDateCondition = { assignedAt: dateCondition.createdAt };

    const assignmentsByStatus = await db.serviceAssignment.groupBy({
        by: ['status'],
        where: { ...centerCondition, ...assignmentDateCondition },
        _count: { id: true }
    });

    const assignmentStatusMap = {};
    let totalAssignments = 0;
    assignmentsByStatus.forEach(s => {
        assignmentStatusMap[s.status] = s._count.id;
        totalAssignments += s._count.id;
    });

    const byTechnician = await db.serviceAssignment.groupBy({
        by: ['technicianId', 'technicianName'],
        where: { ...centerCondition, ...assignmentDateCondition },
        _count: { id: true }
    });

    const technicianWorkload = byTechnician.map(t => ({
        technicianId: t.technicianId,
        name: t.technicianName,
        assignments: t._count.id
    }));

    const completedAssignments = assignmentStatusMap['COMPLETED'] || 0;
    const completionRate = totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

    const avgAssignmentsPerTechnician = byTechnician.length > 0
        ? Math.round(totalAssignments / byTechnician.length * 10) / 10
        : 0;

    return {
        totalAssignments,
        byStatus: assignmentStatusMap,
        byTechnician: technicianWorkload,
        avgAssignmentsPerTechnician,
        completionRate,
        activeTechnicians: byTechnician.length
    };
}

async function calculateApprovalMetrics(targetBranchId, dateCondition, skipEnforcer) {
    const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};
    const originCondition = targetBranchId ? { originBranchId: targetBranchId } : {};

    const [sentByStatus, receivedByStatus] = await Promise.all([
        db.maintenanceApprovalRequest.groupBy({ by: ['status'], where: { ...originCondition, ...dateCondition }, _count: { id: true } }),
        db.maintenanceApprovalRequest.groupBy({ by: ['status'], where: { ...centerCondition, ...dateCondition }, _count: { id: true } })
    ]);

    const sentStatusMap = {};
    sentByStatus.forEach(s => { sentStatusMap[s.status] = s._count.id; });
    const receivedStatusMap = {};
    receivedByStatus.forEach(s => { receivedStatusMap[s.status] = s._count.id; });

    const totalSubmitted = Object.values(sentStatusMap).reduce((a, b) => Number(a) + Number(b), 0);
    const totalReceived = Object.values(receivedStatusMap).reduce((a, b) => Number(a) + Number(b), 0);

    const respondedApprovals = await db.maintenanceApprovalRequest.findMany({
        where: { ...originCondition, respondedAt: { not: null }, ...dateCondition },
        select: { createdAt: true, respondedAt: true }
    });

    let avgWaitTimeHours = 0;
    if (respondedApprovals.length > 0) {
        const totalWait = respondedApprovals.reduce((sum, a) => sum + (new Date(a.respondedAt) - new Date(a.createdAt)) / (1000 * 60 * 60), 0);
        avgWaitTimeHours = Math.round(totalWait / respondedApprovals.length * 10) / 10;
    }

    const rejectedCount = sentStatusMap['REJECTED'] || 0;
    const approvalRate = totalSubmitted > 0 ? Math.round(((sentStatusMap['APPROVED'] || 0) / totalSubmitted) * 100) : 0;

    return {
        submitted: totalSubmitted, received: totalReceived, approved: sentStatusMap['APPROVED'] || 0, rejected: rejectedCount,
        pending: sentStatusMap['PENDING'] || 0, approvalRate, rejectionRate: totalSubmitted > 0 ? Math.round((rejectedCount / totalSubmitted) * 100) : 0,
        avgWaitTimeHours, avgWaitTimeDays: Math.round(avgWaitTimeHours / 24 * 10) / 10, sentByStatus: sentStatusMap, receivedByStatus: receivedStatusMap
    };
}

async function calculatePartsMetrics(branchCondition, dateCondition, skipEnforcer) {
    const partsUsed = await db.stockMovement.aggregate({
        where: { ...branchCondition, type: 'OUT', ...dateCondition, ...skipEnforcer },
        _sum: { quantity: true }, _count: { id: true }
    });

    const partsByPart = await db.stockMovement.groupBy({
        by: ['partId'], where: { ...branchCondition, type: 'OUT', ...dateCondition },
        _sum: { quantity: true }, _count: { id: true }
    });

    const partIds = partsByPart.map(p => p.partId);
    let parts = [];
    if (partIds.length > 0) {
        parts = await db.sparePart.findMany({ where: { id: { in: partIds } }, select: { id: true, name: true, defaultCost: true } });
    }
    const partsMap = {};
    parts.forEach(p => { partsMap[p.id] = p; });

    const topParts = partsByPart.map(p => ({
        partId: p.partId, name: partsMap[p.partId]?.name || 'Unknown', quantity: p._sum.quantity,
        cost: (partsMap[p.partId]?.defaultCost || 0) * p._sum.quantity
    })).sort((a, b) => b.quantity - a.quantity).slice(0, 10);

    const totalPartsCost = topParts.reduce((sum, p) => sum + p.cost, 0);
    const requestsWithParts = await db.maintenanceRequest.count({ where: { ...branchCondition, status: 'Closed', usedParts: { not: null }, ...dateCondition, ...skipEnforcer } });
    const closedAtCondition = { closedAt: dateCondition.createdAt };
    const totalUsedPartsEntries = await db.usedPartLog.count({ where: { ...branchCondition, ...closedAtCondition, ...skipEnforcer } });

    return {
        totalPartsUsed: partsUsed._sum.quantity || 0, totalMovements: partsUsed._count.id || 0, totalPartsCost: Math.round(totalPartsCost),
        avgCostPerRequest: requestsWithParts > 0 ? Math.round(totalPartsCost / requestsWithParts) : 0, topParts, usedPartLogs: totalUsedPartsEntries
    };
}

async function calculateStatusDistribution(branchCondition) {
    const machinesByStatus = await db.warehouseMachine.groupBy({ by: ['status'], where: branchCondition, _count: { id: true } });
    const statusMap = {};
    machinesByStatus.forEach(s => { statusMap[s.status] = s._count.id; });

    const bottleneckStatuses = ['AWAITING_APPROVAL', 'INSPECTION', 'AWAITING_PARTS'];
    const bottleneckCount = bottleneckStatuses.reduce((sum, status) => sum + (statusMap[status] || 0), 0);

    return {
        machineStatuses: statusMap, totalMachinesInWarehouse: Object.values(statusMap).reduce((a, b) => Number(a) + Number(b), 0),
        bottleneckCount, bottleneckStatuses: bottleneckStatuses.filter(s => statusMap[s] > 0)
    };
}

async function calculatePaymentMetrics(branchCondition, dateCondition, targetBranchId, skipEnforcer) {
    const payments = await db.payment.aggregate({
        where: { ...branchCondition, requestId: { not: null }, ...dateCondition, ...skipEnforcer },
        _sum: { amount: true }, _count: { id: true }
    });

    let debtAsDebtor = 0, debtAsCreditor = 0;
    if (targetBranchId) {
        const debtorResult = await db.branchDebt.aggregate({ where: { debtorBranchId: targetBranchId, status: 'PENDING' }, _sum: { remainingAmount: true } });
        debtAsDebtor = debtorResult._sum.remainingAmount || 0;
        const creditorResult = await db.branchDebt.aggregate({ where: { creditorBranchId: targetBranchId, status: 'PENDING' }, _sum: { remainingAmount: true } });
        debtAsCreditor = creditorResult._sum.remainingAmount || 0;
    }

    const requestsWithCost = await db.maintenanceRequest.count({ where: { ...branchCondition, totalCost: { gt: 0 }, receiptNumber: null, status: 'Closed', ...skipEnforcer } });

    return {
        totalRevenue: Math.round(payments._sum.amount || 0), totalPayments: payments._count.id || 0,
        avgPaymentAmount: payments._count.id > 0 ? Math.round((payments._sum.amount || 0) / payments._count.id) : 0,
        branchDebtOwed: Math.round(debtAsDebtor), branchDebtOwing: Math.round(debtAsCreditor), pendingPaymentRequests: requestsWithCost
    };
}

function calculatePerformanceIndicators(requestMetrics, technicianMetrics, approvalMetrics, partsMetrics) {
    const firstTimeFixRate = approvalMetrics.submitted > 0
        ? Math.round(((approvalMetrics.approved - (approvalMetrics.rejected * 0.5)) / Math.max(approvalMetrics.submitted, 1)) * 100)
        : requestMetrics.closedThisPeriod > 0 ? 85 : 0;

    const bottlenecks = [];
    if (requestMetrics.pendingApproval > 5) bottlenecks.push({ area: 'Approval Queue', count: requestMetrics.pendingApproval });
    if (approvalMetrics.avgWaitTimeHours > 24) bottlenecks.push({ area: 'Approval Response Time', avgHours: approvalMetrics.avgWaitTimeHours });

    let healthScore = 100;
    if (requestMetrics.onTimeRate < 80) healthScore -= (80 - requestMetrics.onTimeRate);
    if (approvalMetrics.rejectionRate > 20) healthScore -= (approvalMetrics.rejectionRate - 20);
    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    let healthGrade = 'A';
    if (healthScore < 90) healthGrade = 'B';
    else if (healthScore < 75) healthGrade = 'C';
    else if (healthScore < 60) healthGrade = 'D';
    else if (healthScore < 40) healthGrade = 'F';

    return {
        firstTimeFixRate: Math.max(0, Math.min(100, firstTimeFixRate)),
        bottlenecks, healthScore, healthGrade,
        recommendations: generateRecommendations(requestMetrics, technicianMetrics, approvalMetrics)
    };
}

function generateRecommendations(requestMetrics, technicianMetrics, approvalMetrics) {
    const recommendations = [];
    if (requestMetrics.onTimeRate < 70) recommendations.push('Consider increasing technician capacity');
    if (approvalMetrics.avgWaitTimeHours > 24) recommendations.push('Streamline the approval process');
    if (approvalMetrics.rejectionRate > 30) recommendations.push('Review diagnostic guidelines');
    return recommendations;
}

async function calculateWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer) {
    const inBranchWhere = targetBranchId ? { branchId: targetBranchId, servicedByBranchId: null, ...dateCondition } : { servicedByBranchId: null, ...dateCondition, ...skipEnforcer };
    const inBranchCount = await db.maintenanceRequest.count({ where: inBranchWhere });

    const sentToCenterWhere = targetBranchId ? { branchId: targetBranchId, servicedByBranchId: { not: null }, ...dateCondition } : { servicedByBranchId: { not: null }, ...dateCondition, ...skipEnforcer };
    const sentToCenterCount = await db.maintenanceRequest.count({ where: sentToCenterWhere });

    const assignmentDateCondition = { assignedAt: dateCondition.createdAt };
    const receivedAtCenterCount = targetBranchId ? await db.serviceAssignment.count({ where: { centerBranchId: targetBranchId, ...assignmentDateCondition } }) : await db.serviceAssignment.count({ where: { ...assignmentDateCondition, ...skipEnforcer } });

    const warehouseStats = await db.warehouseMachine.groupBy({ by: ['status'], where: targetBranchId ? { branchId: targetBranchId } : {}, _count: { id: true } });
    const warehouseStatusMap = {};
    warehouseStats.forEach(s => { warehouseStatusMap[s.status] = s._count.id; });

    return { inBranch: { total: inBranchCount }, sentToCenter: { total: sentToCenterCount }, receivedAtCenter: { total: receivedAtCenterCount }, warehouseStatus: warehouseStatusMap };
}

// Center-specific
async function calculateCenterRequestMetrics(servicedByCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer) {
    const byStatus = await db.maintenanceRequest.groupBy({ by: ['status'], where: { ...servicedByCondition, ...dateCondition }, _count: { id: true } });
    const statusMap = {};
    let total = 0;
    byStatus.forEach(s => { statusMap[s.status] = s._count.id; total += s._count.id; });

    const closedRequests = await db.maintenanceRequest.findMany({ where: { ...servicedByCondition, status: 'Closed', closingTimestamp: { gte: rangeStart, lte: rangeEnd }, ...skipEnforcer }, select: { createdAt: true, closingTimestamp: true } });
    let avgTimeToCompletion = 0, onTimeCount = 0;
    if (closedRequests.length > 0) {
        const totalHours = closedRequests.reduce((sum, r) => sum + (new Date(r.closingTimestamp) - new Date(r.createdAt)) / (1000 * 60 * 60), 0);
        avgTimeToCompletion = Math.round(totalHours / closedRequests.length * 10) / 10;
        closedRequests.forEach(r => { if ((new Date(r.closingTimestamp) - new Date(r.createdAt)) / (1000 * 60 * 60) <= 48) onTimeCount++; });
    }

    return { total, byStatus: statusMap, avgTimeToCompletionHours: avgTimeToCompletion, onTimeRate: closedRequests.length > 0 ? Math.round((onTimeCount / closedRequests.length) * 100) : 0, closedThisPeriod: closedRequests.length };
}

async function calculateCenterTechnicianMetrics(centerCondition, dateCondition, targetBranchId) {
    const assignmentDateCondition = { assignedAt: dateCondition.createdAt };
    const assignmentsByStatus = await db.serviceAssignment.groupBy({ by: ['status'], where: { ...centerCondition, ...assignmentDateCondition }, _count: { id: true } });
    const assignmentStatusMap = {};
    let totalAssignments = 0;
    assignmentsByStatus.forEach(s => { assignmentStatusMap[s.status] = s._count.id; totalAssignments += s._count.id; });

    const byTechnician = await db.serviceAssignment.groupBy({ by: ['technicianId', 'technicianName'], where: { ...centerCondition, ...assignmentDateCondition }, _count: { id: true } });
    const technicianWorkload = byTechnician.map(t => ({ technicianId: t.technicianId, name: t.technicianName, assignments: t._count.id }));

    const completedAssignments = assignmentStatusMap['COMPLETED'] || 0;
    const completedAssignmentsList = await db.serviceAssignment.findMany({
        where: { ...centerCondition, status: 'COMPLETED', completedAt: { not: null }, ...assignmentDateCondition },
        select: { assignedAt: true, completedAt: true }
    });

    let avgRepairTimeHours = 0;
    if (completedAssignmentsList.length > 0) {
        const totalHours = completedAssignmentsList.reduce((sum, a) => sum + (new Date(a.completedAt) - new Date(a.assignedAt)) / (1000 * 60 * 60), 0);
        avgRepairTimeHours = Math.round(totalHours / completedAssignmentsList.length * 10) / 10;
    }

    return { totalAssignments, byStatus: assignmentStatusMap, byTechnician: technicianWorkload, completionRate: totalAssignments > 0 ? Math.round((completedAssignments / totalAssignments) * 100) : 0, avgRepairTimeHours };
}

async function calculateCenterApprovalMetrics(targetBranchId, dateCondition, skipEnforcer) {
    const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};
    const receivedByStatus = await db.maintenanceApprovalRequest.groupBy({ by: ['status'], where: { ...centerCondition, ...dateCondition }, _count: { id: true } });
    const receivedStatusMap = {};
    receivedByStatus.forEach(s => { receivedStatusMap[s.status] = s._count.id; });
    const totalReceived = Object.values(receivedStatusMap).reduce((a, b) => Number(a) + Number(b), 0);

    const respondedApprovals = await db.maintenanceApprovalRequest.findMany({ where: { ...centerCondition, respondedAt: { not: null }, ...dateCondition }, select: { createdAt: true, respondedAt: true } });
    let avgResponseTimeHours = 0;
    if (respondedApprovals.length > 0) {
        const totalResponse = respondedApprovals.reduce((sum, a) => sum + (new Date(a.respondedAt) - new Date(a.createdAt)) / (1000 * 60 * 60), 0);
        avgResponseTimeHours = Math.round(totalResponse / respondedApprovals.length * 10) / 10;
    }

    return { received: totalReceived, approved: receivedStatusMap['APPROVED'] || 0, rejected: receivedStatusMap['REJECTED'] || 0, approvalRate: totalReceived > 0 ? Math.round(((receivedStatusMap['APPROVED'] || 0) / totalReceived) * 100) : 0, avgResponseTimeHours };
}

async function calculateCenterPartsMetrics(centerCondition, dateCondition, skipEnforcer) {
    const partsUsed = await db.stockMovement.aggregate({ where: { ...centerCondition, type: 'OUT', ...dateCondition, ...skipEnforcer }, _sum: { quantity: true }, _count: { id: true } });
    const partsByPart = await db.stockMovement.groupBy({ by: ['partId'], where: { ...centerCondition, type: 'OUT', ...dateCondition }, _sum: { quantity: true }, _count: { id: true } });
    const partIds = partsByPart.map(p => p.partId);
    const parts = await db.sparePart.findMany({ where: { id: { in: partIds } }, select: { id: true, name: true, defaultCost: true } });
    const partsMap = {};
    parts.forEach(p => { partsMap[p.id] = p; });

    const topParts = partsByPart.map(p => ({ partId: p.partId, name: partsMap[p.partId]?.name || 'Unknown', quantity: p._sum.quantity, cost: (partsMap[p.partId]?.defaultCost || 0) * p._sum.quantity })).sort((a, b) => b.quantity - a.quantity);
    const totalPartsCost = topParts.reduce((sum, p) => sum + p.cost, 0);

    return { totalPartsUsed: partsUsed._sum.quantity || 0, totalPartsCost: Math.round(totalPartsCost), topParts };
}

async function calculateCenterStatusDistribution(centerCondition) {
    const machinesByStatus = await db.warehouseMachine.groupBy({ by: ['status'], where: centerCondition, _count: { id: true } });
    const statusMap = {};
    machinesByStatus.forEach(s => { statusMap[s.status] = s._count.id; });
    return { machineStatuses: statusMap, totalMachinesAtCenter: Object.values(statusMap).reduce((a, b) => Number(a) + Number(b), 0) };
}

async function calculateCenterPaymentMetrics(centerCondition, dateCondition, targetBranchId, skipEnforcer) {
    const repairRevenue = await db.maintenanceRequest.aggregate({
        where: { ...centerCondition, status: 'Closed', totalCost: { gt: 0 }, ...dateCondition, ...skipEnforcer },
        _sum: { totalCost: true }
    });

    // To get collected amount for a center, we sum payments for requests serviced by this center
    // Since Payment doesn't have a direct relation in Prisma schema, we fetch request IDs first
    const centerRequests = await db.maintenanceRequest.findMany({
        where: { ...centerCondition, status: 'Closed', ...dateCondition, ...skipEnforcer },
        select: { id: true }
    });
    const requestIds = centerRequests.map(r => r.id);

    const payments = await db.payment.aggregate({
        where: {
            requestId: { in: requestIds },
            ...skipEnforcer
        },
        _sum: { amount: true }
    });

    return {
        totalRevenue: Math.round(repairRevenue._sum.totalCost || 0),
        totalCollected: Math.round(payments._sum.amount || 0)
    };
}

async function calculateCenterWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer) {
    const servicedByCondition = targetBranchId ? { servicedByBranchId: targetBranchId } : {};
    const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};
    const assignmentDateCondition = { assignedAt: dateCondition.createdAt };

    const receivedCount = await db.serviceAssignment.count({ where: targetBranchId ? { centerBranchId: targetBranchId, ...assignmentDateCondition } : { ...assignmentDateCondition, ...skipEnforcer } });
    const completedCount = await db.serviceAssignment.count({ where: targetBranchId ? { centerBranchId: targetBranchId, status: 'COMPLETED', completedAt: dateCondition.createdAt } : { status: 'COMPLETED', completedAt: dateCondition.createdAt, ...skipEnforcer } });

    const warehouseStats = await db.warehouseMachine.groupBy({ by: ['status'], where: targetBranchId ? { branchId: targetBranchId } : {}, _count: { id: true } });
    const warehouseStatusMap = {};
    warehouseStats.forEach(s => { warehouseStatusMap[s.status] = s._count.id; });

    const requestsByOriginBranch = await db.maintenanceRequest.groupBy({ by: ['branchId'], where: { ...servicedByCondition, ...dateCondition }, _count: { id: true } });

    return { machinesReceived: { total: receivedCount }, repairsCompleted: { total: completedCount }, warehouseStatus: warehouseStatusMap, requestsByOriginBranch: requestsByOriginBranch.map(r => ({ branchId: r.branchId, count: r._count.id })) };
}

module.exports = {
    calculateRequestMetrics,
    calculateTechnicianMetrics,
    calculateApprovalMetrics,
    calculatePartsMetrics,
    calculateStatusDistribution,
    calculatePaymentMetrics,
    calculatePerformanceIndicators,
    generateRecommendations,
    calculateWorkflowBreakdown,
    calculateCenterRequestMetrics,
    calculateCenterTechnicianMetrics,
    calculateCenterApprovalMetrics,
    calculateCenterPartsMetrics,
    calculateCenterStatusDistribution,
    calculateCenterPaymentMetrics,
    calculateCenterWorkflowBreakdown
};
