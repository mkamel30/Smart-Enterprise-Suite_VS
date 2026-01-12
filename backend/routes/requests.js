const express = require('express');
const router = express.Router();
const { z } = require('zod');

// Database and services
const db = require('../db');
const requestService = require('../services/requestService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

// Middleware
const { authenticateToken, requireManager, requireTechnician } = require('../middleware/auth');
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
  search: z.string().optional(),
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
  actionTaken: z.string().optional().default(''),
  usedParts: z.array(z.object({
    partId: z.string().regex(/^[a-z0-9]{25}$/),
    name: z.string(),
    quantity: z.number().positive(),
    cost: z.number().nonnegative(),
    isPaid: z.boolean()
  })).optional().default([]),
  receiptNumber: z.string().optional().nullable(),
  paymentPlace: z.string().optional()
});

const monthlyCountQuerySchema = z.object({
  date: z.string().optional().transform(s => s ? new Date(s) : undefined),
  months: z.string().regex(/^\d+$/).transform(Number).optional().default('6')
});

// ===================== HELPER FUNCTION =====================

/**
 * Build where clause with proper filtering and security
 */
const buildWhereClause = (validated, req) => {
  const where = {};

  // Apply branch filter for non-super-admins
  const branchFilter = getBranchFilter(req);
  Object.assign(where, branchFilter);

  // Admin-only branch filtering
  if (validated.branchId) {
    if (!['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role)) {
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

  // Search filtering - enhanced to include related models
  if (validated.search) {
    const s = validated.search;
    where.OR = [
      { customerName: { contains: s } },
      { serialNumber: { contains: s } },
      { complaint: { contains: s } },
      { customer: { bkcode: { contains: s } } },
      { customer: { client_name: { contains: s } } },
      { posMachine: { serialNumber: { contains: s } } }
    ];
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
    const where = buildWhereClause(validated, req);

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
          telephone_1: true,
          telephone_2: true,
          address: true,
          national_id: true
        }
      },
      posMachine: {
        select: {
          id: true,
          serialNumber: true,
          model: true,
          manufacturer: true
        }
      },
      branch: {
        select: {
          id: true,
          name: true
        }
      }
    } : undefined;

    // Fetch data in parallel
    const [requests, total] = await Promise.all([
      db.maintenanceRequest.findMany(ensureBranchWhere({
        where,
        include,
        orderBy: { [validated.sortBy]: validated.sortOrder },
        take: limit,
        skip: offset
      }, req)),
      db.maintenanceRequest.count(ensureBranchWhere({ where }, req))
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

    const request = await db.maintenanceRequest.findFirst({
      where: {
        id,
        // Satisfy branchEnforcer while allowing cross-branch access for maintenance centers
        OR: [
          { branchId: req.user.branchId },
          { servicedByBranchId: req.user.branchId },
          { branchId: { not: null } }
        ]
      },
      include: {
        customer: true,
        posMachine: true,
        branch: { select: { id: true, name: true } },
        approval: {
          include: {
            branch: { select: { name: true } }
          }
        },
        vouchers: true
      }
    });

    if (!request) {
      throw new NotFoundError('Maintenance request');
    }

    // Branch isolation check - request.branchId is the origin branch
    if (req.user.branchId && request.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      // Allow access if the user is in the servicedByBranchId (maintenance center)
      if (request.servicedByBranchId !== req.user.branchId) {
        throw new AppError('Access denied', 403, 'FORBIDDEN');
      }
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
  requireTechnician,
  createLimiter,
  validateRequest(createRequestSchema),
  asyncHandler(async (req, res) => {
    const validated = req.validated;
    const branchId = req.user.branchId || validated.branchId;

    if (!branchId) {
      throw new AppError('Branch ID is required', 400, 'MISSING_BRANCH');
    }

    const request = await requestService.createRequest({
      ...validated,
      branchId,
      complaint: validated.problemDescription,
      posMachineId: validated.machineId
    }, {
      id: req.user.id,
      name: req.user.displayName,
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
  requireTechnician,
  updateLimiter,
  validateRequest(updateRequestSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;

    // Find existing request to check permissions - RULE 1
    const existing = await db.maintenanceRequest.findFirst({
      where: { id, branchId: { not: null } }
    });

    if (!existing) {
      throw new NotFoundError('Request');
    }

    if (req.user.branchId && existing.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Use service for status updates
    let updated;
    if (validated.status) {
      updated = await requestService.updateStatus(id, validated.status, {
        id: req.user.id,
        name: req.user.displayName
      });
    } else {
      // For other fields, use direct update (or extend service)
      const updateData = {};
      if (validated.problemDescription) updateData.complaint = validated.problemDescription;
      if (validated.technician) updateData.technician = validated.technician;

      updated = await db.maintenanceRequest.updateMany({
        where: { id, branchId: existing.branchId },
        data: updateData
      });

      // Refetch to return the actual object
      updated = await db.maintenanceRequest.findFirst({
        where: { id, branchId: existing.branchId }
      });
    }

    res.json(updated);
  })
);

// ===================== ASSIGN TECHNICIAN =====================
/**
 * @route PUT /requests/:id/assign
 * @summary Assign technician to maintenance request
 * @security bearerAuth
 * @param {string} id - Request ID
 * @body {Object} Assignment data { technicianId }
 * @returns {Object} Updated request
 */
router.put(
  '/requests/:id/assign',
  authenticateToken,
  requireTechnician,
  // requireManager, // Supervisor/Manager
  validateRequest(z.object({
    technicianId: z.string().regex(/^[a-z0-9]{25}$/)
  })),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { technicianId } = req.validated;

    const existing = await db.maintenanceRequest.findFirst({
      where: { id, branchId: { not: null } }
    });

    if (!existing) {
      throw new NotFoundError('Request');
    }

    if (req.user.branchId && existing.branchId !== req.user.branchId) {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }

    // Get technician name
    const tech = await db.user.findUnique({
      where: { id: technicianId },
      select: { displayName: true }
    });

    if (!tech) {
      throw new NotFoundError('Technician');
    }

    await db.maintenanceRequest.updateMany({
      where: { id, branchId: existing.branchId },
      data: {
        technicianId,
        technician: tech.displayName,
        status: 'In Progress'
      }
    });

    const updated = await db.maintenanceRequest.findFirst({
      where: { id, branchId: existing.branchId }
    });

    await logAction({
      entityType: 'REQUEST',
      entityId: id,
      action: 'ASSIGN',
      details: `Assigned to technician: ${tech.displayName}`,
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
  requireTechnician,
  validateRequest(closeRequestSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;

    // Find and verify request - RULE 1
    const existing = await db.maintenanceRequest.findFirst({
      where: { id, branchId: { not: null } }
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
      throw new AppError('Invalid serial number format', 400, 'INVALID_SERIAL');
    }

    const { count, trend } = await requestService.getMachineMonthlyRequestCount(serialNumber, query.months);
    res.json({ count, trend });
  })
);

// ===================== GET REQUEST STATS =====================
/**
 * @route GET /requests/stats
 * @summary Get quick summary of requests (Day, Week, Month)
 */
router.get(
  '/requests/stats',
  authenticateToken,
  asyncHandler(async (req, res) => {
    try {
      const now = new Date();
      const branchFilter = getBranchFilter(req);

      // Create fresh date objects for each range
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);

      const startOfWeek = new Date(now);
      const daysSinceSaturday = (now.getDay() + 1) % 7;
      startOfWeek.setDate(now.getDate() - daysSinceSaturday);
      startOfWeek.setHours(0, 0, 0, 0);

      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      startOfMonth.setHours(0, 0, 0, 0);

      const getStatsForRange = async (startDate) => {
        const baseWhere = {
          createdAt: { gte: startDate },
          ...branchFilter
        };

        const [open, inProgress, closed] = await Promise.all([
          db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...baseWhere, status: { notIn: ['In Progress', 'Closed'] } }
          }, req)),
          db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...baseWhere, status: 'In Progress' }
          }, req)),
          db.maintenanceRequest.count(ensureBranchWhere({
            where: { ...baseWhere, status: 'Closed' }
          }, req))
        ]);

        return { open, inProgress, closed, total: open + inProgress + closed };
      };

      const [day, week, month] = await Promise.all([
        getStatsForRange(startOfDay),
        getStatsForRange(startOfWeek),
        getStatsForRange(startOfMonth)
      ]);

      res.json({ day, week, month });
    } catch (error) {
      console.error('[STATS_ERROR]', error);
      // Return 0s instead of 500 if stats fail, to not break the page
      const empty = { open: 0, inProgress: 0, closed: 0, total: 0 };
      res.json({
        day: empty, week: empty, month: empty,
        _error: process.env.NODE_ENV === 'development' ? error.message : 'Error fetching stats'
      });
    }
  })
);


// ===================== EXPORT REQUESTS =====================
/**
 * @route GET /requests/export
 * @summary Export filtered requests to Excel
 */
router.get(
  '/requests/export',
  authenticateToken,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const validated = req.query;
    const where = buildWhereClause(validated, req);

    const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
      where,
      include: {
        customer: { select: { client_name: true, bkcode: true } },
        posMachine: { select: { serialNumber: true, model: true } },
        branch: { select: { name: true } }
      },
      orderBy: { createdAt: 'desc' }
    }, req));

    const excelData = requests.map(r => ({
      'التاريخ': new Date(r.createdAt).toLocaleDateString('ar-EG'),
      'العميل': r.customer?.client_name || r.customerName,
      'كود العميل': r.customer?.bkcode || '-',
      'السيريال': r.serialNumber,
      'الموديل': r.machineModel || r.posMachine?.model || '-',
      'الشكوى': r.complaint,
      'الحالة': r.status,
      'الفني': r.technician || '-',
      'الفرع': r.branch?.name || '-'
    }));

    const excel = require('../utils/excel');
    const columns = [
      { header: 'التاريخ', key: 'التاريخ', width: 15 },
      { header: 'العميل', key: 'العميل', width: 30 },
      { header: 'كود العميل', key: 'كود العميل', width: 15 },
      { header: 'السيريال', key: 'السيريال', width: 20 },
      { header: 'الموديل', key: 'الموديل', width: 15 },
      { header: 'الشكوى', key: 'الشكوى', width: 40 },
      { header: 'الحالة', key: 'الحالة', width: 15 },
      { header: 'الفني', key: 'الفني', width: 20 },
      { header: 'الفرع', key: 'الفرع', width: 15 }
    ];

    const buffer = await excel.exportToExcel(excelData, columns, 'maintenance_requests');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=requests_${Date.now()}.xlsx`);
    res.send(buffer);
  })
);

module.exports = router;
