const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');
const maintenanceCenterService = require('../services/maintenanceCenterService');
const { createNotification } = require('./notifications');
const { ForbiddenError } = require('../utils/errors');
const { isGlobalRole } = require('../utils/constants');

/**
 * @swagger
 * tags:
 *   name: Maintenance Center
 *   description: Maintenance center workflow management API
 */

// ============================================
// MACHINE MANAGEMENT ENDPOINTS
// ============================================

/**
 * @swagger
 * /maintenance-center/machines:
 *   get:
 *     summary: Get all machines at the maintenance center
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by machine status
 *       - in: query
 *         name: technicianId
 *         schema:
 *           type: string
 *         description: Filter by assigned technician
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by serial, model, or customer name
 *     responses:
 *       200:
 *         description: List of machines at the center
 */
router.get('/machines', authenticateToken, asyncHandler(async (req, res) => {
  const machines = await maintenanceCenterService.getMachines(req.query, req.user);
  res.json({
    success: true,
    count: machines.length,
    data: machines
  });
}));

/**
 * @swagger
 * /maintenance-center/machines/by-serial/:serialNumber:
 *   get:
 *     summary: Get machine by serial number
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: serialNumber
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Machine details
 *       404:
 *         description: Machine not found
 */
router.get('/machines/by-serial/:serialNumber', authenticateToken, asyncHandler(async (req, res) => {
  const { serialNumber } = req.params;
  const machines = await maintenanceCenterService.getMachines({ search: serialNumber }, req.user);
  const machine = machines.find(m => m.serialNumber === serialNumber);
  
  if (!machine) {
    return res.status(404).json({
      success: false,
      error: 'Machine not found'
    });
  }
  
  res.json({
    success: true,
    data: machine
  });
}));

/**
 * @swagger
 * /maintenance-center/machines/{id}:
 *   get:
 *     summary: Get single machine details
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Machine details
 *       404:
 *         description: Machine not found
 */
router.get('/machines/:id', authenticateToken, asyncHandler(async (req, res) => {
  const machine = await maintenanceCenterService.getMachineById(req.params.id, req.user);
  res.json({
    success: true,
    data: machine
  });
}));

// ============================================
// TECHNICIAN ASSIGNMENT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/assign:
 *   post:
 *     summary: Assign technician to machine
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               technicianId:
 *                 type: string
 *               technicianName:
 *                 type: string
 *     responses:
 *       200:
 *         description: Technician assigned successfully
 */
router.post('/machines/:id/assign', authenticateToken, asyncHandler(async (req, res) => {
  const { technicianId, technicianName } = req.body;

  if (!technicianId || !technicianName) {
    return res.status(400).json({
      success: false,
      error: 'technicianId and technicianName are required'
    });
  }

  const result = await maintenanceCenterService.assignTechnician(
    req.params.id,
    { technicianId, technicianName },
    req.user
  );

  res.json({
    success: true,
    message: 'Technician assigned successfully',
    data: result
  });
}));

// ============================================
// INSPECTION ENDPOINT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/inspect:
 *   post:
 *     summary: Perform initial inspection on machine
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               problemDescription:
 *                 type: string
 *               estimatedCost:
 *                 type: number
 *               requiredParts:
 *                 type: array
 *                 items:
 *                   type: object
 *     responses:
 *       200:
 *         description: Inspection completed
 */
router.post('/machines/:id/inspect', authenticateToken, asyncHandler(async (req, res) => {
  const { problemDescription, estimatedCost, requiredParts } = req.body;

  if (!problemDescription) {
    return res.status(400).json({
      success: false,
      error: 'problemDescription is required'
    });
  }

  const result = await maintenanceCenterService.inspectMachine(
    req.params.id,
    { problemDescription, estimatedCost, requiredParts },
    req.user
  );

  const message = result.approvalRequest
    ? 'Inspection completed. Approval request created automatically due to high cost.'
    : 'Inspection completed successfully';

  res.json({
    success: true,
    message,
    data: result
  });
}));

// ============================================
// REPAIR ENDPOINT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/repair:
 *   post:
 *     summary: Start repair on machine
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repairType:
 *                 type: string
 *                 enum: [FREE_NO_PARTS, FREE_WITH_PARTS, PAID_WITH_PARTS]
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *               cost:
 *                 type: number
 *     responses:
 *       200:
 *         description: Repair started
 */
router.post('/machines/:id/repair', authenticateToken, asyncHandler(async (req, res) => {
  const { repairType, parts, cost } = req.body;

  if (!repairType) {
    return res.status(400).json({
      success: false,
      error: 'repairType is required (FREE_NO_PARTS, FREE_WITH_PARTS, PAID_WITH_PARTS)'
    });
  }

  const result = await maintenanceCenterService.startRepair(
    req.params.id,
    { repairType, parts, cost },
    req.user
  );

  const message = result.debtRecord
    ? 'Repair started. Debt record created for paid repair.'
    : 'Repair started successfully';

  res.json({
    success: true,
    message,
    data: result
  });
}));

// ============================================
// APPROVAL REQUEST ENDPOINT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/request-approval:
 *   post:
 *     summary: Request branch approval for costly repairs
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               cost:
 *                 type: number
 *               parts:
 *                 type: array
 *                 items:
 *                   type: object
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Approval request sent to branch
 */
router.post('/machines/:id/request-approval', authenticateToken, asyncHandler(async (req, res) => {
  const { cost, parts, notes } = req.body;

  if (!cost || cost <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Valid cost is required'
    });
  }

  const result = await maintenanceCenterService.requestApproval(
    req.params.id,
    { cost, parts, notes },
    req.user
  );

  res.json({
    success: true,
    message: 'Approval request sent to branch successfully',
    data: result
  });
}));

// ============================================
// MARK REPAIRED ENDPOINT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/mark-repaired:
 *   post:
 *     summary: Mark machine as repaired and generate voucher
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               repairNotes:
 *                 type: string
 *               actionTaken:
 *                 type: string
 *     responses:
 *       200:
 *         description: Machine marked as repaired
 */
router.post('/machines/:id/mark-repaired', authenticateToken, asyncHandler(async (req, res) => {
  const { repairNotes, actionTaken } = req.body;

  const result = await maintenanceCenterService.markRepaired(
    req.params.id,
    { repairNotes, actionTaken },
    req.user
  );

  res.json({
    success: true,
    message: 'Machine marked as repaired successfully',
    data: result
  });
}));

// ============================================
// TOTAL LOSS ENDPOINT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/total-loss:
 *   post:
 *     summary: Mark machine as total loss and create return shipment
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               reason:
 *                 type: string
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Machine marked as total loss
 */
router.post('/machines/:id/total-loss', authenticateToken, asyncHandler(async (req, res) => {
  const { reason, notes } = req.body;

  if (!reason) {
    return res.status(400).json({
      success: false,
      error: 'reason is required'
    });
  }

  const result = await maintenanceCenterService.markTotalLoss(
    req.params.id,
    { reason, notes },
    req.user
  );

  res.json({
    success: true,
    message: 'Machine marked as total loss. Return transfer order created automatically.',
    data: result
  });
}));

// ============================================
// RETURN TO BRANCH ENDPOINT
// ============================================

/**
 * @swagger
 * /maintenance-center/machines/{id}/return:
 *   post:
 *     summary: Return machine to origin branch
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               notes:
 *                 type: string
 *               driverName:
 *                 type: string
 *               driverPhone:
 *                 type: string
 *     responses:
 *       200:
 *         description: Machine scheduled for return
 */
router.post('/machines/:id/return', authenticateToken, asyncHandler(async (req, res) => {
  const { notes, driverName, driverPhone } = req.body;

  const result = await maintenanceCenterService.returnToBranch(
    req.params.id,
    { notes, driverName, driverPhone },
    req.user
  );

  res.json({
    success: true,
    message: 'Machine scheduled for return to branch',
    data: result
  });
}));

// ============================================
// STATISTICS AND DASHBOARD ENDPOINTS
// ============================================

/**
 * @swagger
 * /maintenance-center/stats:
 *   get:
 *     summary: Get maintenance center statistics
 *     tags: [Maintenance Center]
 *     responses:
 *       200:
 *         description: Center statistics
 */
router.get('/stats', authenticateToken, asyncHandler(async (req, res) => {
  const stats = await maintenanceCenterService.getStats(req.user);
  res.json({
    success: true,
    data: stats
  });
}));

/**
 * @swagger
 * /maintenance-center/pending-approvals:
 *   get:
 *     summary: Get pending approval requests for the center
 *     tags: [Maintenance Center]
 *     responses:
 *       200:
 *         description: List of pending approvals
 */
router.get('/pending-approvals', authenticateToken, asyncHandler(async (req, res) => {
  const approvals = await maintenanceCenterService.getPendingApprovals(req.user);
  res.json({
    success: true,
    count: approvals.length,
    data: approvals
  });
}));

/**
 * @swagger
 * /maintenance-center/dashboard:
 *   get:
 *     summary: Get dashboard data for maintenance center
 *     tags: [Maintenance Center]
 *     responses:
 *       200:
 *         description: Dashboard data
 */
router.get('/dashboard', authenticateToken, asyncHandler(async (req, res) => {
  const [stats, machines, pendingApprovals] = await Promise.all([
    maintenanceCenterService.getStats(req.user),
    maintenanceCenterService.getMachines({ limit: 10 }, req.user),
    maintenanceCenterService.getPendingApprovals(req.user)
  ]);

  res.json({
    success: true,
    data: {
      stats,
      recentMachines: machines.slice(0, 5),
      pendingApprovals: pendingApprovals.slice(0, 5),
      summary: {
        totalActive: stats.totalMachines,
        urgentRepairs: stats.repairing + stats.underInspection,
        awaitingApprovals: stats.waitingApproval,
        readyToReturn: stats.repaired
      }
    }
  });
}));

// ============================================
// BRANCH TRACKING ENDPOINTS
// ============================================

/**
 * @swagger
 * /maintenance-center/branch-machines/{branchId}:
 *   get:
 *     summary: Get machines from a branch that are at maintenance center
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: List of machines from this branch at center
 */
router.get('/branch-machines/:branchId', authenticateToken, asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  
  // Security check: user can only access their own branch unless admin
  const isAdmin = isGlobalRole(req.user.role);
  if (!isAdmin && req.user.branchId !== branchId) {
    throw new ForbiddenError('Access denied: You can only view machines from your own branch');
  }

  const machines = await maintenanceCenterService.getBranchMachinesAtCenter(branchId);

  res.json({
    success: true,
    count: machines.length,
    data: machines
  });
}));

/**
 * @swagger
 * /maintenance-center/branch-machines/{branchId}/summary:
 *   get:
 *     summary: Get summary statistics for branch machines at center
 *     tags: [Maintenance Center]
 *     parameters:
 *       - in: path
 *         name: branchId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Summary statistics
 */
router.get('/branch-machines/:branchId/summary', authenticateToken, asyncHandler(async (req, res) => {
  const { branchId } = req.params;
  
  // Security check: user can only access their own branch unless admin
  const isAdmin = isGlobalRole(req.user.role);
  if (!isAdmin && req.user.branchId !== branchId) {
    throw new ForbiddenError('Access denied: You can only view machines from your own branch');
  }

  const summary = await maintenanceCenterService.getBranchMachinesSummary(branchId);

  res.json({
    success: true,
    data: summary
  });
}));

// ============================================
// RETURN PACKAGE ENDPOINTS
// ============================================

/**
 * GET /maintenance-center/return/ready
 * Get machines ready for return to their origin branches
 */
router.get('/return/ready', authenticateToken, asyncHandler(async (req, res) => {
  const machines = await maintenanceCenterService.getMachinesReadyForReturn(req.user);
  
  res.json({
    success: true,
    count: machines.length,
    data: machines
  });
}));

/**
 * POST /maintenance-center/return/create
 * Create return package(s) to send machines back to origin branches
 * 
 * Request body:
 * {
 *   machineIds: ["id1", "id2", ...],
 *   notes: "optional notes",
 *   driverName: "driver name",
 *   driverPhone: "driver phone"
 * }
 */
router.post('/return/create', authenticateToken, asyncHandler(async (req, res) => {
  const { machineIds, notes, driverName, driverPhone } = req.body;

  if (!machineIds || !Array.isArray(machineIds) || machineIds.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'يرجى اختيار ماكينة واحدة على الأقل'
    });
  }

  const result = await maintenanceCenterService.createReturnPackage({
    machineIds,
    notes,
    driverName,
    driverPhone
  }, req.user);

  res.status(201).json({
    success: true,
    message: result.message,
    data: result
  });
}));

module.exports = router;
