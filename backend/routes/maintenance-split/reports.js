const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { authenticateToken } = require('../../middleware/auth');
const { isGlobalRole, ROLES } = require('../../utils/constants');
const { success, error } = require('../../utils/apiResponse');
const asyncHandler = require('../../utils/asyncHandler');
const { logAction } = require('../../utils/logger');
const reportService = require('../../services/maintenance/reportService');

const reportCache = new Map();
const CACHE_TTL = 5 * 60 * 1000;

function getCacheKey(branchId, startDate, endDate, reportType) {
    return `${reportType}:${branchId || 'all'}:${startDate}:${endDate}`;
}

function getFromCache(key) {
    const cached = reportCache.get(key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) return cached.data;
    reportCache.delete(key);
    return null;
}

function setCache(key, data) {
    reportCache.set(key, { data, timestamp: Date.now() });
}

const reportQuerySchema = z.object({
    branchId: z.string().optional(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    reportType: z.enum(['branch', 'center', 'combined']).optional().default('combined')
});

/**
 * GET /branch-performance-report
 * Generate maintenance performance report
 */
router.get('/branch-performance-report', authenticateToken, asyncHandler(async (req, res) => {
    try {
        const { branchId, startDate, endDate, reportType } = reportQuerySchema.parse(req.query);
        let targetBranchId = req.user.branchId;
        const userIsGlobal = isGlobalRole(req.user.role);
        const userIsCenter = req.user.role === ROLES.CENTER_MANAGER || req.user.role === ROLES.CENTER_TECH;

        if (userIsGlobal && branchId) targetBranchId = branchId;
        else if (userIsGlobal && !branchId) targetBranchId = null;

        const now = new Date();
        const rangeStart = startDate ? new Date(startDate) : new Date(now.getFullYear(), now.getMonth(), 1);
        const rangeEnd = endDate ? new Date(endDate + 'T23:59:59.999Z') : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

        const cacheKey = getCacheKey(targetBranchId, rangeStart.toISOString(), rangeEnd.toISOString(), reportType);
        const cached = getFromCache(cacheKey);
        if (cached) return success(res, { ...cached, fromCache: true });

        const branchCondition = targetBranchId ? { branchId: targetBranchId } : {};
        const centerCondition = targetBranchId ? { centerBranchId: targetBranchId } : {};
        const servicedByCondition = targetBranchId ? { servicedByBranchId: targetBranchId } : {};
        const warehouseMachineCondition = targetBranchId ? { branchId: targetBranchId } : {};
        const stockMovementCondition = targetBranchId ? { branchId: targetBranchId } : {};

        const skipEnforcer = targetBranchId ? {} : { OR: [{ branchId: { not: '0000_SYSTEM_BYPASS' } }, { branchId: null }] };
        const dateCondition = { createdAt: { gte: rangeStart, lte: rangeEnd } };

        let requestMetrics, technicianMetrics, approvalMetrics, partsMetrics, statusDistribution, paymentMetrics, performanceIndicators, workflowBreakdown;

        if (userIsCenter) {
            requestMetrics = await reportService.calculateCenterRequestMetrics(servicedByCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer);
            technicianMetrics = await reportService.calculateCenterTechnicianMetrics(centerCondition, dateCondition, targetBranchId);
            approvalMetrics = await reportService.calculateCenterApprovalMetrics(targetBranchId, dateCondition, skipEnforcer);
            partsMetrics = await reportService.calculateCenterPartsMetrics(stockMovementCondition, dateCondition, skipEnforcer);
            statusDistribution = await reportService.calculateCenterStatusDistribution(warehouseMachineCondition);
            paymentMetrics = await reportService.calculateCenterPaymentMetrics(servicedByCondition, dateCondition, targetBranchId, skipEnforcer);
            performanceIndicators = reportService.calculatePerformanceIndicators(requestMetrics, technicianMetrics, approvalMetrics, partsMetrics);
            workflowBreakdown = await reportService.calculateCenterWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer);
        } else {
            requestMetrics = await reportService.calculateRequestMetrics(branchCondition, dateCondition, rangeStart, rangeEnd, skipEnforcer);
            technicianMetrics = await reportService.calculateTechnicianMetrics(branchCondition, dateCondition, targetBranchId);
            approvalMetrics = await reportService.calculateApprovalMetrics(targetBranchId, dateCondition, skipEnforcer);
            partsMetrics = await reportService.calculatePartsMetrics(branchCondition, dateCondition, skipEnforcer);
            statusDistribution = await reportService.calculateStatusDistribution(branchCondition);
            paymentMetrics = await reportService.calculatePaymentMetrics(branchCondition, dateCondition, targetBranchId, skipEnforcer);
            performanceIndicators = reportService.calculatePerformanceIndicators(requestMetrics, technicianMetrics, approvalMetrics, partsMetrics);
            workflowBreakdown = await reportService.calculateWorkflowBreakdown(targetBranchId, dateCondition, skipEnforcer);
        }

    const report = {
        generatedAt: new Date().toISOString(),
        dateRange: { start: rangeStart.toISOString(), end: rangeEnd.toISOString() },
        branchId: targetBranchId,
        reportType,
        isCenterReport: userIsCenter,
        requestMetrics,
        technicianMetrics,
        approvalMetrics,
        partsMetrics,
        statusDistribution,
        paymentMetrics,
        performanceIndicators,
        workflowBreakdown
    };

    setCache(cacheKey, report);
    await logAction({
        entityType: 'REPORT',
        entityId: 'maintenance-performance',
        action: 'GENERATE',
        details: `Performance report generated`,
        performedBy: req.user.displayName || req.user.email,
        userId: req.user.id,
        branchId: req.user.branchId
    });

    return success(res, report);
    } catch (err) {
        console.error('[ERROR] Branch performance report failed:', err.message, err.stack);
        return error(res, 'Failed to generate report: ' + err.message, 500);
    }
}));

module.exports = router;
