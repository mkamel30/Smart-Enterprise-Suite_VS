const express = require('express');
const router = express.Router();
const { z } = require('zod');

// Database and services
const db = require('../db');
const requestService = require('../services/requestService');

// Middleware
const { authenticateToken, requireManager } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { createLimiter } = require('../middleware/rateLimits');

// Utilities
const { asyncHandler, AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');

// Schemas
const {
  createRequestSchema,
  updateRequestSchema,
  closeRequestSchema,
  monthlyCountQuerySchema
} = require('../validation/schemas/request.schema');

// ===================== VALIDATION SCHEMAS =====================

const listQuerySchema = z.object({
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  status: z.enum(['Open', 'In Progress', 'Closed', 'PENDING_TRANSFER', 'AT_CENTER']).optional(),
  customerId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).optional().default('0'),
  sortBy: z.enum(['createdAt', 'status', 'customerId']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc')
});

const idParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{25}$/)
});

// ===================== GET ALL REQUESTS =====================

/**
 * @route GET /requests
 * @summary Get all maintenance requests
 * @security bearerAuth
 * @queryParam {string} branchId - Filter by branch
 * @queryParam {string} status - Filter by status
 * @queryParam {number} limit - Results per page (max 100)
 * @queryParam {number} offset - Page offset
 * @returns {Array} List of requests
 */
router.get('/requests',
  authenticateToken,
  asyncHandler(async (req, res, next) => {
    // Validate query parameters
    const validated = listQuerySchema.parse(req.query);

    // Build filter with security checks
    const branchFilter = getBranchFilter(req);
    const where = { ...branchFilter };

    // Admin-only branch filtering
    if (validated.branchId) {
      if (!['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role)) {
        throw new AppError(
          'Insufficient permissions to filter by branch',
          403,
          'FORBIDDEN'
        );
      }
      where.branchId = validated.branchId;
    }

    // Status filtering
    if (validated.status) {
      where.status = validated.status;
    }

    // Customer filtering
    if (validated.customerId) {
      where.customerId = validated.customerId;
    }

    // Safe pagination (max 100 per request)
    const limit = Math.min(validated.limit, 100);
    const offset = Math.max(0, validated.offset);

    // Fetch data
    const [requests, total] = await Promise.all([
      db.maintenanceRequest.findMany({
        where,
        include: {
          customer: {
            select: {
              id: true,
              client_name: true,
              bkcode: true,
              supply_office: true,
              telephone_1: true
            }
          },
          posMachine: {
            select: {
              id: true,
              serialNumber: true,
              model: true,
              manufacturer: true
            }
          }
        },
        orderBy: { [validated.sortBy]: validated.sortOrder },
        take: limit,
        skip: offset
      }),
      db.maintenanceRequest.count({ where })
    ]);

    res.json({
      data: requests,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// ===================== GET SINGLE REQUEST =====================

/**
 * @route GET /requests/:id
 * @summary Get specific maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @returns {Object} Request details
 */
router.get('/requests/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const request = await db.maintenanceRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        posMachine: true,
        branch: true,
        approval: true,
        vouchers: true
      }
    });

    if (!request) {
      throw new NotFoundError('Maintenance request');
    }

    // Branch isolation check
    if (req.user.branchId && request.branchId !== req.user.branchId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    res.json(request);
  })
);

// ===================== CREATE REQUEST =====================

/**
 * @route POST /requests
 * @summary Create new maintenance request
 * @security bearerAuth
 * @body {Object} Request data
 * @returns {Object} Created request
 */
router.post('/requests',
  authenticateToken,
  createLimiter,
  validateRequest(createRequestSchema),
  asyncHandler(async (req, res) => {
    const validated = req.validated;

    // Determine branch
    const branchId = req.user.branchId || validated.branchId;
    if (!branchId) {
      throw new AppError('Branch ID is required', 400, 'MISSING_BRANCH');
    }

    // Verify customer exists
    const customer = await db.customer.findUnique({
      where: { bkcode: validated.customerId }
    });

    if (!customer) {
      throw new NotFoundError('Customer');
    }

    // Verify machine if provided
    let machine = null;
    if (validated.machineId) {
      machine = await db.posMachine.findUnique({
        where: { id: validated.machineId }
      });

      if (!machine) {
        throw new NotFoundError('Machine');
      }
    }

    // Create request within transaction
    const request = await db.$transaction(async (tx) => {
      const newRequest = await tx.maintenanceRequest.create({
        data: {
          branchId,
          customerId: customer.bkcode,
          customerName: customer.client_name,
          posMachineId: machine?.id || null,
          serialNumber: machine?.serialNumber || null,
          machineModel: machine?.model,
          machineManufacturer: machine?.manufacturer,
          complaint: validated.problemDescription,
          status: validated.status,
          createdAt: new Date()
        }
      });

      // If taking machine to warehouse
      if (validated.takeMachine && machine) {
        await requestService.receiveMachineToWarehouse(tx, {
          serialNumber: machine.serialNumber,
          customerId: customer.bkcode,
          customerName: customer.client_name,
          requestId: newRequest.id,
          branchId,
          performedBy: req.user.displayName
        });
      }

      return newRequest;
    });

    // Audit logging
    await logAction({
      entityType: 'REQUEST',
      entityId: request.id,
      action: 'CREATE',
      details: `Created maintenance request for ${customer.client_name}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId
    });

    res.status(201).json(request);
  })
);

// ===================== CLOSE REQUEST =====================

/**
 * @route PUT /requests/:id/close
 * @summary Close maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @body {Object} Closure data
 * @returns {Object} Closed request
 */
router.put('/requests/:id/close',
  authenticateToken,
  validateRequest(closeRequestSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;

    // Find and verify request
    const existing = await db.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('Request');
    }

    // Branch isolation
    if (req.user.branchId && existing.branchId !== req.user.branchId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Close via service
    const request = await requestService.closeRequest(
      id,
      validated.actionTaken,
      validated.usedParts || [],
      {
        id: req.user.id,
        name: req.user.displayName
      },
      validated.receiptNumber
    );

    // Audit logging
    await logAction({
      entityType: 'REQUEST',
      entityId: id,
      action: 'CLOSE',
      details: `Closed request with receipt ${validated.receiptNumber || 'N/A'}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: req.user.branchId
    });

    res.json(request);
  })
);

// ===================== MONTHLY REPAIR COUNT =====================

/**
 * @route GET /requests/machine/:serialNumber/monthly-count
 * @summary Get monthly repair count for machine
 * @security bearerAuth
 * @param {string} serialNumber - Machine serial number
 * @queryParam {string} date - Specific date (YYYY-MM-DD)
 * @returns {Object} Repair count
 */
router.get('/requests/machine/:serialNumber/monthly-count',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { serialNumber } = req.params;
    const query = monthlyCountQuerySchema.parse(req.query);

    // Find machine
    const machine = await db.posMachine.findUnique({
      where: { serialNumber },
      include: { customer: true }
    });

    if (!machine) {
      throw new NotFoundError('Machine');
    }

    // Branch isolation
    if (req.user.branchId && machine.customer?.branchId !== req.user.branchId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Calculate target date and month range
    const targetDate = query.date || new Date();
    const startOfMonth = new Date(targetDate.getFullYear(), targetDate.getMonth(), 1);

    // Count closed requests this month up to target date
    const count = await db.maintenanceRequest.count({
      where: {
        posMachineId: machine.id,
        status: 'Closed',
        closingTimestamp: {
          gte: startOfMonth,
          lte: targetDate
        },
        ...(req.user.branchId && { branchId: req.user.branchId })
      }
    });

    res.json({
      machineId: machine.id,
      serialNumber: machine.serialNumber,
      month: startOfMonth.toISOString().split('T')[0],
      targetDate: targetDate.toISOString().split('T')[0],
      repairCount: count
    });
  })
);

// ===================== ASSIGN TECHNICIAN =====================

/**
 * @route PUT /requests/:id/assign
 * @summary Assign technician to request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @body {Object} Assignment data
 * @returns {Object} Updated request
 */
router.put('/requests/:id/assign',
  authenticateToken,
  requireManager,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { technicianId } = z.object({
      technicianId: z.string().regex(/^[a-z0-9]{25}$/)
    }).parse(req.body);

    // Verify request exists
    const existing = await db.maintenanceRequest.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('Request');
    }

    // Branch isolation
    if (req.user.branchId && existing.branchId !== req.user.branchId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Verify technician exists
    const technician = await db.user.findUnique({
      where: { id: technicianId }
    });

    if (!technician) {
      throw new NotFoundError('Technician');
    }

    // Update request
    const updated = await db.maintenanceRequest.update({
      where: { id },
      data: {
        technician: technician.displayName,
        status: 'In Progress'
      }
    });

    // Audit logging
    await logAction({
      entityType: 'REQUEST',
      entityId: id,
      action: 'ASSIGN_TECHNICIAN',
      details: `Assigned to ${technician.displayName}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: req.user.branchId
    });

    res.json(updated);
  })
);

// ===================== DELETE REQUEST
