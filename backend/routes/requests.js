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
const { createLimiter, updateLimiter, deleteLimiter } = require('../middleware/rateLimits');

// Utilities
const { asyncHandler, AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');

// ===================== VALIDATION SCHEMAS =====================

const listQuerySchema = z.object({
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  status: z.enum(['Open', 'In Progress', 'Closed', 'PENDING_TRANSFER', 'AT_CENTER']).optional(),
  customerId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional().default('0'),
  sortBy: z.enum(['createdAt', 'status', 'customerId', 'id']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  includeRelations: z.enum(['true', 'false']).optional().default('false')
});

const idParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{25}$/)
});

const createRequestSchema = z.object({
  customerId: z.string().min(1, 'Customer ID required'),
  machineId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  problemDescription: z.string().min(5, 'Problem description must be at least 5 characters'),
  status: z.enum(['Open', 'In Progress']).optional().default('Open'),
  takeMachine: z.boolean().optional().default(false),
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional()
});

const updateRequestSchema = z.object({
  status: z.enum(['Open', 'In Progress', 'Closed', 'PENDING_TRANSFER', 'AT_CENTER']).optional(),
  problemDescription: z.string().min(5).optional(),
  technician: z.string().optional()
});

const closeRequestSchema = z.object({
  actionTaken: z.string().min(10, 'Action taken description must be at least 10 characters'),
  usedParts: z.array(z.object({
    partName: z.string(),
    quantity: z.number().positive(),
    cost: z.number().nonnegative().optional()
  })).optional().default([]),
  receiptNumber: z.string().optional()
});

const monthlyCountQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).transform(s => new Date(s)).optional()
});

// ===================== HELPER FUNCTION =====================

/**
 * Build where clause with proper filtering and security
 */
const buildWhereClause = (validated, user) => {
  const where = {};
  
  // Apply branch filter for non-super-admins
  const branchFilter = getBranchFilter(user);
  Object.assign(where, branchFilter);
  
  // Admin-only branch filtering
  if (validated.branchId) {
    if (!['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(user.role)) {
      throw new AppError('Insufficient permissions to filter by branch', 403, 'FORBIDDEN');
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
  
  return where;
};

// ===================== GET ALL REQUESTS =====================
/**
 * @route GET /requests
 * @summary Get all maintenance requests with pagination
 * @security bearerAuth
 * @queryParam {string} branchId - Filter by branch
 * @queryParam {string} status - Filter by status
 * @queryParam {number} limit - Results per page (max 100)
 * @queryParam {number} offset - Page offset
 * @queryParam {boolean} includeRelations - Include customer and machine data
 * @returns {Array} List of requests with pagination
 */
router.get(
  '/requests',
  authenticateToken,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const validated = req.query;
    
    // Build filter with security checks
    const where = buildWhereClause(validated, req.user);
    
    // Safe pagination (max 100 per request)
    const limit = Math.min(validated.limit, 100);
    const offset = Math.max(0, validated.offset);
    
    // Determine if we should include relationships
    const shouldIncludeRelations = validated.includeRelations === 'true';
    const include = shouldIncludeRelations ? {
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
    } : undefined;
    
    // Fetch data in parallel
    const [requests, total] = await Promise.all([
      db.maintenanceRequest.findMany({
        where,
        include,
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
 * @summary Get specific maintenance request with all details
 * @security bearerAuth
 * @param {string} id - Request ID
 * @returns {Object} Request details with all relations
 */
router.get(
  '/requests/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    
    const request = await db.maintenanceRequest.findUnique({
      where: { id },
      include: {
        customer: true,
        posMachine: true,
        branch: { select: { id: true, name: true, location: true } },
        approval: true,
        vouchers: true
      }
    });
    
    if (!request) {
      throw new NotFoundError('Maintenance request');
    }
    
    // Branch isolation check
    if (req.user.branchId && request.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
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
router.post(
  '/requests',
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

// ===================== UPDATE REQUEST =====================
/**
 * @route PUT /requests/:id
 * @summary Update maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @body {Object} Update data
 * @returns {Object} Updated request
 */
router.put(
  '/requests/:id',
  authenticateToken,
  updateLimiter,
  validateRequest(updateRequestSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;
    
    // Find existing request
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
    
    // Build update data
    const updateData = {};
    if (validated.status) updateData.status = validated.status;
    if (validated.problemDescription) updateData.complaint = validated.problemDescription;
    if (validated.technician) updateData.technician = validated.technician;
    
    const updated = await db.maintenanceRequest.update({
      where: { id },
      data: updateData
    });
    
    // Audit logging
    await logAction({
      entityType: 'REQUEST',
      entityId: id,
      action: 'UPDATE',
      details: `Updated request status to ${updateData.status || existing.status}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: req.user.branchId
    });
    
    res.json(updated);
  })
);

// ===================== CLOSE REQUEST =====================
/**
 * @route PUT /requests/:id/close
 * @summary Close maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @body {Object} Closure data with action taken and parts used
 * @returns {Object} Closed request
 */
router.put(
  '/requests/:id/close',
  authenticateToken,
  requireManager,
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
    
    // Prevent closing already closed requests
    if (existing.status === 'Closed') {
      throw new AppError('Request is already closed', 400, 'REQUEST_ALREADY_CLOSED');
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
 * @summary Get monthly repair count for a specific machine
 * @security bearerAuth
 * @param {string} serialNumber - Machine serial number
 * @queryParam {string} date - Specific date (YYYY-MM-DD)
 * @returns {Object} Repair count for the month
 */
router.get(
  '/requests/machine/:serialNumber/monthly-count',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { serialNumber } = req.params;
    const query = monthlyCountQuerySchema.parse(req.query);
    
    // Validate serial number format
    if (!serialNumber || serialNumber.length < 3) {
      throw new AppError('Invalid serial number format', 400, 'INVALID_SERIAL
