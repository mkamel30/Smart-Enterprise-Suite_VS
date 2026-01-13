/**
 * Maintenance Performance Report Routes
 * Comprehensive branch-level reporting for maintenance operations
 * Includes in-branch and maintenance center metrics
 */

const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter, isGlobalRole } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { logAction } = require('../utils/logger');

// Cache for reports (5-minute TTL)
const reportCache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(branchId, startDate, endDate, reportType) {
    return `${reportType}:${branchId || 'all'}:${startDate}:${endDate}`;
}

function getFromCache(key) {
    const cached = reportCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        return cached.data;
    }
    reportCache.delete(key);
    return null;
}

function setCache(key, data) {
    reportCache.set(key, { data, timestamp: Date.now() });
}

// Validation schemas
const reportQuerySchema = z.object({
    branchId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reportType: z.enum(['branch', 'center', 'combined']).optional().default('combined')
});

/**
 * GET /branch-performance-report
 * Comprehensive maintenance performance report for branch-level reporting
 */
router.get('/branch-performance-report', authenticateToken, async (req, res) => {
    try {
        const { branchId, startDate, endDate, reportType } = reportQuerySchema.parse(req.query);

        // Determine branch filter
        let targetBranchId = req.user.branchId;
        const userIsGlobal = isGlobalRole(req.user.role);

        // Allow global roles to filter by branchId
        if (userIsGlobal && branchId) {
            targetBranchId = branchId;
        } else if (userIsGlobal && !branchId) {
            targetBranchId = null; // All branches
        }

        // Calculate date range (default: current month)
        const now = new Date();
        const rangeStart = startDate
            ? new Date(startDate)
            : new Date(now.getFullYear(), now.getMonth(), 1);
        const rangeEnd = endDate
            ? new Date(endDate + 'T23:59:59.999Z')
            : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        // Check cache
        const cacheKey = getCacheKey(targetBranchId, rangeStart.toISOString(), rangeEnd.toISOString(), reportType);
        const cached = getFromCache(cacheKey);
        if (cached) {
            return res.json({ ...cached, fromCache: true });
        }

        // Build branch filter condition
        // If targetBranchId is null (global report), we define skipEnforcer for enforced queries
        const branchCondition = targetBranchId ? { branchId: targetBranchId } : {};
        const skipEnforcer = targetBranchId ? {} : { _skipBranchEnforcer: true };
        const dateCondition = { createdAt: { gte: rangeStart, lte: rangeEnd } };

        // === 1. REQUEST METRICS ===
        const requestMetrics = await calculateRequestMetrics(branchCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer);

        // === 2. TECHNICIAN METRICS ===
        // Technician metrics only use groupBy which is not enforced, so we don't need skipEnforcer
        const technicianMetrics = await calculateTechnicianMetrics(branchCondition, dateCondition, targetBranchId);

        // === 3. APPROVAL METRICS ===
        const approvalMetrics = await calculateApprovalMetrics(targetBranchId, dateCondition, skipEnforcer);

        // === 4. PARTS & COST METRICS ===
        const partsMetrics = await calculatePartsMetrics(branchCondition, dateCondition, skipEnforcer);

        // === 5. STATUS DISTRIBUTION ===
        const statusDistribution = await calculateStatusDistribution(branchCondition);

        // === 6. PAYMENT METRICS ===
        const paymentMetrics = await calculatePaymentMetrics(branchCondition, dateCondition, targetBranchId, skipEnforcer);

        // === 7. PERFORMANCE INDICATORS ===
        const performanceIndicators = calculatePerformanceIndicators(
            requestMetrics,
            technicianMetrics,
            approvalMetrics,
            partsMetrics
        );

        // === 8. IN-BRANCH VS CENTER BREAKDOWN ===
        const workflowBreakdown = await calculateWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer);

        const report = {
            generatedAt: new Date().toISOString(),
            dateRange: {
                start: rangeStart.toISOString(),
                end: rangeEnd.toISOString()
            },
            branchId: targetBranchId,
            reportType,
            requestMetrics,
            technicianMetrics,
            approvalMetrics,
            partsMetrics,
            statusDistribution,
            paymentMetrics,
            performanceIndicators,
            workflowBreakdown
        };

        // Cache the result
        setCache(cacheKey, report);

        // Log report generation
        await logAction({
            entityType: 'REPORT',
            entityId: 'maintenance-performance',
            action: 'GENERATE',
            details: `Performance report generated for ${targetBranchId || 'all branches'}`,
            performedBy: req.user.displayName || req.user.email,
            userId: req.user.id,
            branchId: req.user.branchId
        });

        res.json(report);
    } catch (error) {
        console.error('Failed to generate performance report:', error);
        res.status(500).json({ error: 'فشل في إنشاء تقرير الأداء', details: error.message });
    }
});

// === HELPER FUNCTIONS ===

async function calculateRequestMetrics(branchCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer) {
    // Total requests by status
    const byStatus = await db.maintenanceRequest.groupBy({
        by: ['status'],
        where: { ...branchCondition, ...dateCondition }, // groupBy is not enforced
        _count: { id: true }
    });

    const statusMap = {};
    let total = 0;
    byStatus.forEach(s => {
        statusMap[s.status] = s._count.id;
        total += s._count.id;
    });

    // Average time to completion (for closed requests)
    const closedRequests = await db.maintenanceRequest.findMany({
        where: {
            ...branchCondition,
            status: 'Closed',
            closingTimestamp: { gte: rangeStart, lte: rangeEnd },
            ...skipEnforcer // findMany is enforced
        },
        select: { createdAt: true, closingTimestamp: true }
    });

    let avgTimeToCompletion = 0;
    let onTimeCount = 0;
    const targetHours = 48; // Target: 48 hours

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

    // Pending approval count
    const pendingApproval = await db.maintenanceRequest.count({
        where: {
            ...branchCondition,
            status: { in: ['Pending Approval', 'AWAITING_APPROVAL'] },
            ...skipEnforcer // count is enforced
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
    // For service assignments (maintenance center workflow)
    // If targetBranchId is null, we need skip enforcer for center queries too
    const centerCondition = targetBranchId
        ? { centerBranchId: targetBranchId }
        : {};

    // ServiceAssignment uses 'assignedAt' instead of 'createdAt'
    const assignmentDateCondition = {
        assignedAt: dateCondition.createdAt
    };

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

    // Assignments by technician
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

    // Completion rate
    const completedAssignments = assignmentStatusMap['COMPLETED'] || 0;
    const inProgressAssignments = assignmentStatusMap['UNDER_MAINTENANCE'] || 0;
    const completionRate = totalAssignments > 0
        ? Math.round((completedAssignments / totalAssignments) * 100)
        : 0;

    // Average assignments per technician
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
    // MaintenanceApprovalRequest - for center workflow
    const centerCondition = targetBranchId
        ? { centerBranchId: targetBranchId }
        : {};

    const originCondition = targetBranchId
        ? { originBranchId: targetBranchId }
        : {};

    // Approvals submitted FROM this branch (when branch sends to center)
    const sentByStatus = await db.maintenanceApprovalRequest.groupBy({
        by: ['status'],
        where: { ...originCondition, ...dateCondition },
        _count: { id: true }
    });

    // Approvals received BY this center (when center receives from branches)
    const receivedByStatus = await db.maintenanceApprovalRequest.groupBy({
        by: ['status'],
        where: { ...centerCondition, ...dateCondition },
        _count: { id: true }
    });

    const sentStatusMap = {};
    sentByStatus.forEach(s => { sentStatusMap[s.status] = s._count.id; });

    const receivedStatusMap = {};
    receivedByStatus.forEach(s => { receivedStatusMap[s.status] = s._count.id; });

    const totalSubmitted = Object.values(sentStatusMap).reduce((a, b) => Number(a) + Number(b), 0);
    const totalReceived = Object.values(receivedStatusMap).reduce((a, b) => Number(a) + Number(b), 0);

    // Average wait time for approvals
    const respondedApprovals = await db.maintenanceApprovalRequest.findMany({
        where: {
            ...originCondition,
            respondedAt: { not: null },
            ...dateCondition,
            ...skipEnforcer // findMany is enforced
        },
        select: { createdAt: true, respondedAt: true }
    });

    let avgWaitTimeHours = 0;
    if (respondedApprovals.length > 0) {
        const totalWait = respondedApprovals.reduce((sum, a) => {
            return sum + (new Date(a.respondedAt) - new Date(a.createdAt)) / (1000 * 60 * 60);
        }, 0);
        avgWaitTimeHours = Math.round(totalWait / respondedApprovals.length * 10) / 10;
    }

    // Resubmission count (rejected then resubmitted)
    // This is approximated by counting rejections
    const rejectedCount = sentStatusMap['REJECTED'] || 0;

    const approvalRate = totalSubmitted > 0
        ? Math.round(((sentStatusMap['APPROVED'] || 0) / totalSubmitted) * 100)
        : 0;

    return {
        submitted: totalSubmitted,
        received: totalReceived,
        approved: sentStatusMap['APPROVED'] || 0,
        rejected: rejectedCount,
        pending: sentStatusMap['PENDING'] || 0,
        approvalRate,
        rejectionRate: totalSubmitted > 0 ? Math.round((rejectedCount / totalSubmitted) * 100) : 0,
        avgWaitTimeHours,
        avgWaitTimeDays: Math.round(avgWaitTimeHours / 24 * 10) / 10,
        sentByStatus: sentStatusMap,
        receivedByStatus: receivedStatusMap
    };
}

async function calculatePartsMetrics(branchCondition, dateCondition, skipEnforcer) {
    // Stock movements with type OUT
    const partsUsed = await db.stockMovement.aggregate({
        where: {
            ...branchCondition,
            type: 'OUT',
            ...dateCondition,
            ...skipEnforcer // aggregate is enforced
        },
        _sum: { quantity: true },
        _count: { id: true }
    });

    // Get parts breakdown
    const partsByPart = await db.stockMovement.groupBy({
        by: ['partId'],
        where: {
            ...branchCondition,
            type: 'OUT',
            ...dateCondition
        },
        _sum: { quantity: true },
        _count: { id: true }
    });

    // Get part names
    const partIds = partsByPart.map(p => p.partId);
    const parts = await db.sparePart.findMany({
        where: { id: { in: partIds } },
        select: { id: true, name: true, defaultCost: true }
    });

    const partsMap = {};
    parts.forEach(p => { partsMap[p.id] = p; });

    const topParts = partsByPart
        .map(p => ({
            partId: p.partId,
            name: partsMap[p.partId]?.name || 'Unknown',
            quantity: p._sum.quantity,
            cost: (partsMap[p.partId]?.defaultCost || 0) * p._sum.quantity
        }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);

    const totalPartsCost = topParts.reduce((sum, p) => sum + p.cost, 0);

    // Calculate from closed requests with usedParts
    const requestsWithParts = await db.maintenanceRequest.count({
        where: {
            ...branchCondition,
            status: 'Closed',
            usedParts: { not: null },
            ...dateCondition,
            ...skipEnforcer // count is enforced
        }
    });

    const avgCostPerRequest = requestsWithParts > 0
        ? Math.round(totalPartsCost / requestsWithParts)
        : 0;

    // Free vs paid ratio (from UsedPartLog)
    // UsedPartLog uses 'closedAt' instead of 'createdAt'
    const closedAtCondition = { closedAt: dateCondition.createdAt };
    const totalUsedPartsEntries = await db.usedPartLog.count({
        where: { ...branchCondition, ...closedAtCondition, ...skipEnforcer }
    });

    return {
        totalPartsUsed: partsUsed._sum.quantity || 0,
        totalMovements: partsUsed._count.id || 0,
        totalPartsCost: Math.round(totalPartsCost),
        avgCostPerRequest,
        topParts,
        usedPartLogs: totalUsedPartsEntries
    };
}

async function calculateStatusDistribution(branchCondition) {
    // Warehouse machines status distribution
    const machinesByStatus = await db.warehouseMachine.groupBy({
        by: ['status'],
        where: branchCondition, // groupBy is not enforced
        _count: { id: true }
    });

    const statusMap = {};
    machinesByStatus.forEach(s => {
        statusMap[s.status] = s._count.id;
    });

    // Count bottlenecks
    const bottleneckStatuses = ['AWAITING_APPROVAL', 'INSPECTION', 'AWAITING_PARTS'];
    const bottleneckCount = bottleneckStatuses.reduce(
        (sum, status) => sum + (statusMap[status] || 0),
        0
    );

    return {
        machineStatuses: statusMap,
        totalMachinesInWarehouse: Object.values(statusMap).reduce((a, b) => Number(a) + Number(b), 0),
        bottleneckCount,
        bottleneckStatuses: bottleneckStatuses.filter(s => statusMap[s] > 0)
    };
}

async function calculatePaymentMetrics(branchCondition, dateCondition, targetBranchId, skipEnforcer) {
    // Total revenue from payments
    const payments = await db.payment.aggregate({
        where: {
            ...branchCondition,
            requestId: { not: null },
            ...dateCondition,
            ...skipEnforcer // aggregate is enforced
        },
        _sum: { amount: true },
        _count: { id: true }
    });

    // Branch debt (as debtor)
    let debtAsDebtor = 0;
    let debtAsCreditor = 0;

    if (targetBranchId) {
        const debtorResult = await db.branchDebt.aggregate({
            where: {
                debtorBranchId: targetBranchId,
                status: 'PENDING'
            },
            _sum: { remainingAmount: true }
        });
        debtAsDebtor = debtorResult._sum.remainingAmount || 0;

        const creditorResult = await db.branchDebt.aggregate({
            where: {
                creditorBranchId: targetBranchId,
                status: 'PENDING'
            },
            _sum: { remainingAmount: true }
        });
        debtAsCreditor = creditorResult._sum.remainingAmount || 0;
    } else {
        const debtorResult = await db.branchDebt.aggregate({
            where: {
                status: 'PENDING',
                ...skipEnforcer // aggregate is enforced
            },
            _sum: { remainingAmount: true }
        });
        debtAsDebtor = debtorResult._sum.remainingAmount || 0;

        const creditorResult = await db.branchDebt.aggregate({
            where: {
                status: 'PENDING',
                ...skipEnforcer // aggregate is enforced
            },
            _sum: { remainingAmount: true }
        });
        debtAsCreditor = creditorResult._sum.remainingAmount || 0;
    }

    // Pending payments (requests with cost but no payment)
    const requestsWithCost = await db.maintenanceRequest.count({
        where: {
            ...branchCondition,
            totalCost: { gt: 0 },
            receiptNumber: null,
            status: 'Closed',
            ...skipEnforcer // count is enforced
        }
    });

    return {
        totalRevenue: Math.round(payments._sum.amount || 0),
        totalPayments: payments._count.id || 0,
        avgPaymentAmount: payments._count.id > 0
            ? Math.round((payments._sum.amount || 0) / payments._count.id)
            : 0,
        branchDebtOwed: Math.round(debtAsDebtor),
        branchDebtOwing: Math.round(debtAsCreditor),
        pendingPaymentRequests: requestsWithCost
    };
}

function calculatePerformanceIndicators(requestMetrics, technicianMetrics, approvalMetrics, partsMetrics) {
    // First-time fix rate (approximate: completed without rejection)
    const firstTimeFixRate = approvalMetrics.submitted > 0
        ? Math.round(((approvalMetrics.approved - (approvalMetrics.rejected * 0.5)) / Math.max(approvalMetrics.submitted, 1)) * 100)
        : requestMetrics.closedThisPeriod > 0 ? 85 : 0; // Default assumption if no approvals

    // System bottlenecks
    const bottlenecks = [];
    if (requestMetrics.pendingApproval > 5) {
        bottlenecks.push({ area: 'Approval Queue', count: requestMetrics.pendingApproval });
    }
    if (approvalMetrics.avgWaitTimeHours > 24) {
        bottlenecks.push({ area: 'Approval Response Time', avgHours: approvalMetrics.avgWaitTimeHours });
    }
    if (technicianMetrics.completionRate < 50 && technicianMetrics.totalAssignments > 0) {
        bottlenecks.push({ area: 'Assignment Completion', rate: technicianMetrics.completionRate });
    }

    // Calculate health score (0-100)
    let healthScore = 100;

    // Deduct for low on-time rate
    if (requestMetrics.onTimeRate < 80) healthScore -= (80 - requestMetrics.onTimeRate);

    // Deduct for high rejection rate
    if (approvalMetrics.rejectionRate > 20) healthScore -= (approvalMetrics.rejectionRate - 20);

    // Deduct for slow approval response
    if (approvalMetrics.avgWaitTimeHours > 48) healthScore -= 10;

    // Deduct for low completion rate
    if (technicianMetrics.completionRate < 70) healthScore -= (70 - technicianMetrics.completionRate) / 2;

    healthScore = Math.max(0, Math.min(100, Math.round(healthScore)));

    // Health grade
    let healthGrade = 'A';
    if (healthScore < 90) healthGrade = 'B';
    if (healthScore < 75) healthGrade = 'C';
    if (healthScore < 60) healthGrade = 'D';
    if (healthScore < 40) healthGrade = 'F';

    return {
        firstTimeFixRate: Math.max(0, Math.min(100, firstTimeFixRate)),
        bottlenecks,
        healthScore,
        healthGrade,
        recommendations: generateRecommendations(requestMetrics, technicianMetrics, approvalMetrics)
    };
}

function generateRecommendations(requestMetrics, technicianMetrics, approvalMetrics) {
    const recommendations = [];

    if (requestMetrics.onTimeRate < 70) {
        recommendations.push('Consider increasing technician capacity to improve on-time completion rate');
    }
    if (approvalMetrics.avgWaitTimeHours > 24) {
        recommendations.push('Approval response time is high - consider streamlining the approval process');
    }
    if (approvalMetrics.rejectionRate > 30) {
        recommendations.push('High rejection rate detected - review diagnostic guidelines with technicians');
    }
    if (technicianMetrics.avgAssignmentsPerTechnician > 10) {
        recommendations.push('Technicians may be overloaded - consider adding more staff');
    }
    if (requestMetrics.pendingApproval > 10) {
        recommendations.push('Multiple requests awaiting approval - prioritize clearing the approval queue');
    }

    return recommendations;
}

async function calculateWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer) {
    // In-Branch Maintenance (requests handled locally)
    // In-Branch Maintenance (requests handled locally)
    // Note: ensure proper bypass for counting
    const inBranchWhere = targetBranchId
        ? { branchId: targetBranchId, servicedByBranchId: null, ...dateCondition }
        : { servicedByBranchId: null, ...dateCondition, ...skipEnforcer }; // count is enforced

    const inBranchCount = await db.maintenanceRequest.count({ where: inBranchWhere });

    // Sent to Center (requests sent to maintenance center)
    const sentToCenterWhere = targetBranchId
        ? { branchId: targetBranchId, servicedByBranchId: { not: null }, ...dateCondition }
        : { servicedByBranchId: { not: null }, ...dateCondition, ...skipEnforcer }; // count is enforced

    const sentToCenterCount = await db.maintenanceRequest.count({ where: sentToCenterWhere });

    // Received at Center (for maintenance center role)
    // Received at Center (for maintenance center role)
    // ServiceAssignment uses 'assignedAt' for filtering
    const assignmentDateCondition = { assignedAt: dateCondition.createdAt };

    const receivedAtCenterCount = targetBranchId
        ? await db.serviceAssignment.count({
            where: { centerBranchId: targetBranchId, ...assignmentDateCondition }
        })
        : await db.serviceAssignment.count({
            where: { ...assignmentDateCondition, ...skipEnforcer }
        });

    // Machine statuses in warehouse for this branch
    const warehouseStats = await db.warehouseMachine.groupBy({
        by: ['status'],
        where: targetBranchId
            ? { branchId: targetBranchId }
            : {}, // groupBy is not enforced
        _count: { id: true }
    });

    const warehouseStatusMap = {};
    warehouseStats.forEach(s => { warehouseStatusMap[s.status] = s._count.id; });

    return {
        inBranch: {
            total: inBranchCount,
            description: 'Requests handled locally at branch'
        },
        sentToCenter: {
            total: sentToCenterCount,
            description: 'Requests sent to maintenance center'
        },
        receivedAtCenter: {
            total: receivedAtCenterCount,
            description: 'Assignments received at this center'
        },
        warehouseStatus: warehouseStatusMap
    };
}

module.exports = router;
