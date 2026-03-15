const express = require('express');
const router = express.Router();
const asyncHandler = require('../../utils/asyncHandler');
const maintenanceCenterService = require('../../services/maintenanceCenterService');
const { success, error, paginated } = require('../../utils/apiResponse');
const { ROLES, isGlobalRole } = require('../../utils/constants');
const { ForbiddenError } = require('../../utils/errors');

router.get('/machines', asyncHandler(async (req, res) => {
    const result = await maintenanceCenterService.getMachines(req.query, req.user);
    return paginated(res, result.data, result.pagination.total, result.pagination.limit, (result.pagination.page - 1) * result.pagination.limit);
}));

router.get('/machines/by-serial/:serialNumber', asyncHandler(async (req, res) => {
    const { serialNumber } = req.params;
    const result = await maintenanceCenterService.getMachines({ search: serialNumber }, req.user);
    const machines = result.data;
    const machine = machines.find(m => m.serialNumber === serialNumber);
    if (!machine) return error(res, 'Machine not found', 404);
    return success(res, machine);
}));

router.get('/machines/:id', asyncHandler(async (req, res) => {
    const machine = await maintenanceCenterService.getMachineById(req.params.id, req.user);
    return success(res, machine);
}));

router.get('/stats', asyncHandler(async (req, res) => {
    const stats = await maintenanceCenterService.getStats(req.user);
    return success(res, stats);
}));

router.get('/pending-approvals', asyncHandler(async (req, res) => {
    const approvals = await maintenanceCenterService.getPendingApprovals(req.user);
    return success(res, approvals);
}));

router.get('/dashboard', asyncHandler(async (req, res) => {
    const [stats, machinesResult, pendingApprovals] = await Promise.all([
        maintenanceCenterService.getStats(req.user),
        maintenanceCenterService.getMachines({ limit: 10 }, req.user),
        maintenanceCenterService.getPendingApprovals(req.user)
    ]);

    const machines = machinesResult.data;

    return success(res, {
        stats,
        recentMachines: machines.slice(0, 5),
        pendingApprovals: pendingApprovals.slice(0, 5),
        summary: {
            totalActive: stats.totalMachines,
            urgentRepairs: stats.repairing + stats.underInspection,
            awaitingApprovals: stats.waitingApproval,
            readyToReturn: stats.repaired
        }
    });
}));

router.get('/branch-machines/:branchId', asyncHandler(async (req, res) => {
    const { branchId } = req.params;
    if (!isGlobalRole(req.user.role) && req.user.branchId !== branchId) throw new ForbiddenError('Access denied');
    const machines = await maintenanceCenterService.getBranchMachinesAtCenter(branchId);
    return success(res, machines);
}));

router.get('/branch-machines/:branchId/summary', asyncHandler(async (req, res) => {
    const { branchId } = req.params;
    if (!isGlobalRole(req.user.role) && req.user.branchId !== branchId) throw new ForbiddenError('Access denied');
    const summary = await maintenanceCenterService.getBranchMachinesSummary(branchId);
    return success(res, summary);
}));

module.exports = router;
