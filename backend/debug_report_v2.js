
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { attachBranchEnforcer } = require('./prisma/branchEnforcer');

// Attach middleware manually to simulate the environment
attachBranchEnforcer(prisma);

// Mock DB interface that the report route expects directly sometimes, 
// although the report route imports 'db' which is usually the prisma client instance.
// Wait, the report route requires '../db'. Let's see what '../db' exports.
// Assuming it exports the prisma client directly.

async function testReport() {
    try {
        console.log("Starting Debug...");

        // Define filters as they are in the route
        const targetBranchId = null; // Global
        const rangeStart = new Date('2024-01-01');
        const rangeEnd = new Date('2025-12-31');

        const branchCondition = targetBranchId ? { branchId: targetBranchId } : {};
        const skipEnforcer = targetBranchId ? {} : { _skipBranchEnforcer: true };
        const dateCondition = { createdAt: { gte: rangeStart, lte: rangeEnd } };

        console.log("1. Request Metrics...");
        await calculateRequestMetrics(branchCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer);
        console.log("✅ Request Metrics OK");

        console.log("2. Technician Metrics...");
        await calculateTechnicianMetrics(branchCondition, dateCondition, targetBranchId);
        console.log("✅ Technician Metrics OK");

        console.log("3. Approval Metrics...");
        await calculateApprovalMetrics(targetBranchId, dateCondition, skipEnforcer);
        console.log("✅ Approval Metrics OK");

        console.log("4. Parts Metrics...");
        await calculatePartsMetrics(branchCondition, dateCondition, skipEnforcer);
        console.log("✅ Parts Metrics OK");

        console.log("5. Status Distribution...");
        await calculateStatusDistribution(branchCondition);
        console.log("✅ Status Distribution OK");

        console.log("6. Payment Metrics...");
        await calculatePaymentMetrics(branchCondition, dateCondition, targetBranchId, skipEnforcer);
        console.log("✅ Payment Metrics OK");

        console.log("7. Workflow Breakdown...");
        await calculateWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer);
        console.log("✅ Workflow Breakdown OK");

        console.log("🎉 ALL CHECKS PASSED!");

    } catch (error) {
        console.error("❌ ERROR CAUGHT:");
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

// === COPIED HELPER FUNCTIONS (Simplified for context) ===
// I will copy-paste the functions from maintenance-reports.js here to test them isolated
// Note: I will replace 'db' with 'prisma' in the calls.

async function calculateRequestMetrics(branchCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer) {
    // Total requests by status - NO SKIP (GroupBy)
    const byStatus = await prisma.maintenanceRequest.groupBy({
        by: ['status'],
        where: { ...branchCondition, ...dateCondition },
        _count: { id: true }
    });

    // Average time - WITH SKIP (FindMany)
    const closedRequests = await prisma.maintenanceRequest.findMany({
        where: {
            ...branchCondition,
            status: 'Closed',
            closingTimestamp: { gte: rangeStart, lte: rangeEnd },
            ...skipEnforcer
        },
        select: { createdAt: true, closingTimestamp: true }
    });

    // Pending - WITH SKIP (Count)
    const pendingApproval = await prisma.maintenanceRequest.count({
        where: {
            ...branchCondition,
            status: { in: ['Pending Approval', 'AWAITING_APPROVAL'] },
            ...skipEnforcer
        }
    });
}

async function calculateTechnicianMetrics(branchCondition, dateCondition, targetBranchId) {
    const centerCondition = targetBranchId
        ? { centerBranchId: targetBranchId }
        : {};

    // GroupBy - NO SKIP
    await prisma.serviceAssignment.groupBy({
        by: ['status'],
        where: { ...centerCondition, ...dateCondition },
        _count: { id: true }
    });

    // GroupBy - NO SKIP
    await prisma.serviceAssignment.groupBy({
        by: ['technicianId', 'technicianName'],
        where: { ...centerCondition, ...dateCondition },
        _count: { id: true }
    });
}

async function calculateApprovalMetrics(targetBranchId, dateCondition, skipEnforcer) {
    const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};
    const originCondition = targetBranchId ? { originBranchId: targetBranchId } : {};

    // GroupBy - NO SKIP
    await prisma.maintenanceApprovalRequest.groupBy({
        by: ['status'],
        where: { ...originCondition, ...dateCondition },
        _count: { id: true }
    });

    // GroupBy - NO SKIP
    await prisma.maintenanceApprovalRequest.groupBy({
        by: ['status'],
        where: { ...centerCondition, ...dateCondition },
        _count: { id: true }
    });

    // FindMany - WITH SKIP
    await prisma.maintenanceApprovalRequest.findMany({
        where: {
            ...originCondition,
            respondedAt: { not: null },
            ...dateCondition,
            ...skipEnforcer
        },
        select: { createdAt: true, respondedAt: true }
    });
}

async function calculatePartsMetrics(branchCondition, dateCondition, skipEnforcer) {
    // Aggregate - WITH SKIP
    await prisma.stockMovement.aggregate({
        where: {
            ...branchCondition,
            type: 'OUT',
            ...dateCondition,
            ...skipEnforcer
        },
        _sum: { quantity: true },
        _count: { id: true }
    });

    // GroupBy - NO SKIP
    await prisma.stockMovement.groupBy({
        by: ['partId'],
        where: {
            ...branchCondition,
            type: 'OUT',
            ...dateCondition
        },
        _sum: { quantity: true },
        _count: { id: true }
    });

    // Count Requests - WITH SKIP
    await prisma.maintenanceRequest.count({
        where: {
            ...branchCondition,
            status: 'Closed',
            usedParts: { not: null },
            ...dateCondition,
            ...skipEnforcer
        }
    });

    // Count UsedPartLog - WITH SKIP
    await prisma.usedPartLog.count({
        where: { ...branchCondition, ...dateCondition, ...skipEnforcer }
    });
}

async function calculateStatusDistribution(branchCondition) {
    // GroupBy - NO SKIP
    await prisma.warehouseMachine.groupBy({
        by: ['status'],
        where: branchCondition,
        _count: { id: true }
    });
}

async function calculatePaymentMetrics(branchCondition, dateCondition, targetBranchId, skipEnforcer) {
    // Aggregate - WITH SKIP
    await prisma.payment.aggregate({
        where: {
            ...branchCondition,
            requestId: { not: null },
            ...dateCondition,
            ...skipEnforcer
        },
        _sum: { amount: true },
        _count: { id: true }
    });

    // BranchDebt - WITH SKIP (Manual logic check)
    if (targetBranchId) {
        // ... standard logic ...
    } else {
        await prisma.branchDebt.aggregate({
            where: {
                status: 'PENDING',
                ...skipEnforcer
            },
            _sum: { remainingAmount: true }
        });

        await prisma.branchDebt.aggregate({
            where: {
                status: 'PENDING',
                ...skipEnforcer // Check double skip?
            },
            _sum: { remainingAmount: true }
        });
    }

    // Count Requests - WITH SKIP
    await prisma.maintenanceRequest.count({
        where: {
            ...branchCondition,
            totalCost: { gt: 0 },
            receiptNumber: null,
            status: 'Closed',
            ...skipEnforcer
        }
    });
}

async function calculateWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer) {
    // Count - WITH SKIP
    const inBranchWhere = targetBranchId
        ? { branchId: targetBranchId, servicedByBranchId: null, ...dateCondition }
        : { servicedByBranchId: null, ...dateCondition, ...skipEnforcer };
    await prisma.maintenanceRequest.count({ where: inBranchWhere });

    // Count - WITH SKIP
    const sentToCenterWhere = targetBranchId
        ? { branchId: targetBranchId, servicedByBranchId: { not: null }, ...dateCondition }
        : { servicedByBranchId: { not: null }, ...dateCondition, ...skipEnforcer };
    await prisma.maintenanceRequest.count({ where: sentToCenterWhere });

    // Count - WITH SKIP
    if (targetBranchId) {
        await prisma.serviceAssignment.count({
            where: { centerBranchId: targetBranchId, ...dateCondition }
        });
    } else {
        await prisma.serviceAssignment.count({
            where: { ...dateCondition, ...skipEnforcer }
        });
    }

    // GroupBy - NO SKIP (Fix Verification)
    await prisma.warehouseMachine.groupBy({
        by: ['status'],
        where: targetBranchId
            ? { branchId: targetBranchId }
            : {}, // Empty where for global
        _count: { id: true }
    });
}

testReport();
