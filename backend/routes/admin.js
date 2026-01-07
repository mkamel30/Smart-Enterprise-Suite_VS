const express = require('express');
const router = express.Router();
const { z } = require('zod');

// Database
const db = require('../db');

// Middleware
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { createLimiter, updateLimiter, deleteLimiter } = require('../middleware/rateLimits');

// Utilities
const { asyncHandler, AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');
const logger = require('../utils/logger');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

// ===================== VALIDATION SCHEMAS =====================

const listQuerySchema = z.object({
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  entityType: z.enum(['USER', 'CUSTOMER', 'REQUEST', 'MACHINE', 'BRANCH']).optional(),
  action: z.enum(['CREATE', 'UPDATE', 'DELETE', 'IMPORT', 'EXPORT', 'PASSWORD_RESET']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0).optional().default('0'),
  sortBy: z.enum(['createdAt', 'action', 'entityType']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional()
});

const createBranchSchema = z.object({
  name: z.string().min(2, 'Branch name required').max(100),
  location: z.string().min(2).max(255).optional(),
  manager: z.string().email('Valid email required'),
  phone: z.string().regex(/^[0-9\+\-\s]{1,20}$/).optional(),
  address: z.string().max(500).optional(),
  code: z.string().min(2).max(50).optional()
});

const updateBranchSchema = createBranchSchema.partial();

const idParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{25}$/)
});

const systemSettingsSchema = z.object({
  maintenanceMode: z.boolean().optional(),
  maintenanceModeMessage: z.string().max(500).optional(),
  maxUploadSize: z.number().positive().optional(),
  backupEnabled: z.boolean().optional(),
  backupSchedule: z.string().optional(),
  sessionTimeout: z.number().positive().optional(),
  passwordExpirationDays: z.number().positive().optional()
});

// ===================== AUDIT LOG ENDPOINTS =====================

/**
 * @route GET /admin/audit-logs
 * @summary Get system audit logs (super admin only)
 * @security bearerAuth
 * @queryParam {number} limit - Results per page
 * @queryParam {number} offset - Page offset
 * @returns {Object} Paginated audit logs
 */
router.get(
  '/admin/audit-logs',
  authenticateToken,
  requireSuperAdmin,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const validated = req.query;

    // Build filter
    const where = {};

    if (validated.branchId) {
      where.branchId = validated.branchId;
    }

    if (validated.entityType) {
      where.entityType = validated.entityType;
    }

    if (validated.action) {
      where.action = validated.action;
    }

    // Date range filtering
    if (validated.startDate || validated.endDate) {
      where.createdAt = {};
      if (validated.startDate) {
        where.createdAt.gte = validated.startDate;
      }
      if (validated.endDate) {
        where.createdAt.lte = validated.endDate;
      }
    }

    const limit = Math.min(validated.limit, 100);
    const offset = Math.max(0, validated.offset);

    // Fetch logs
    const [logs, total] = await Promise.all([
      db.systemLog.findMany({
        where,
        orderBy: { [validated.sortBy]: validated.sortOrder },
        take: limit,
        skip: offset
      }),
      db.systemLog.count({ where })
    ]);

    res.json({
      data: logs,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    });
  })
);

/**
 * @route GET /admin/audit-logs/:id
 * @summary Get specific audit log entry
 * @security bearerAuth
 * @param {string} id - Log ID
 * @returns {Object} Audit log details
 */
router.get(
  '/admin/audit-logs/:id',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);

    const log = await db.systemLog.findUnique({
      where: { id }
    });

    if (!log) {
      throw new NotFoundError('Audit log');
    }

    res.json(log);
  })
);

/**
 * @route DELETE /admin/audit-logs/older-than/:days
 * @summary Delete old audit logs (cleanup)
 * @security bearerAuth
 * @param {number} days - Delete logs older than this many days
 * @returns {Object} Deletion result
 */
router.delete(
  '/admin/audit-logs/older-than/:days',
  authenticateToken,
  requireSuperAdmin,
  deleteLimiter,
  asyncHandler(async (req, res) => {
    const days = parseInt(req.params.days);

    if (isNaN(days) || days < 1 || days > 365) {
      throw new AppError('Days must be between 1 and 365', 400, 'INVALID_DAYS');
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const result = await db.systemLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });

    // Log the cleanup action
    await logAction({
      entityType: 'SYSTEM',
      entityId: 'AUDIT_CLEANUP',
      action: 'DELETE',
      details: `Deleted ${result.count} logs older than ${days} days`,
      userId: req.user.id,
      performedBy: req.user.displayName
    });

    res.json({
      message: `Deleted ${result.count} audit logs`,
      deletedCount: result.count
    });
  })
);

// ===================== SYSTEM SETTINGS =====================

/**
 * @route GET /admin/settings
 * @summary Get system settings (admin only)
 * @security bearerAuth
 * @returns {Object} System settings
 */
router.get(
  '/admin/settings',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const settings = await db.systemSettings.findFirst();

    if (!settings) {
      // Return defaults if not found
      return res.json({
        maintenanceMode: false,
        maxUploadSize: 10485760, // 10MB
        sessionTimeout: 3600, // 1 hour
        passwordExpirationDays: 90,
        backupEnabled: true,
        backupSchedule: '0 2 * * *'
      });
    }

    res.json(settings);
  })
);

/**
 * @route PUT /admin/settings
 * @summary Update system settings (super admin only)
 * @security bearerAuth
 * @body {Object} Settings to update
 * @returns {Object} Updated settings
 */
router.put(
  '/admin/settings',
  authenticateToken,
  requireSuperAdmin,
  validateRequest(systemSettingsSchema),
  asyncHandler(async (req, res) => {
    const validated = req.validated;

    // Get or create settings
    let settings = await db.systemSettings.findFirst();

    if (!settings) {
      settings = await db.systemSettings.create({
        data: validated
      });
    } else {
      // Update existing
      const updateData = {};
      Object.entries(validated).forEach(([key, value]) => {
        if (value !== undefined) {
          updateData[key] = value;
        }
      });

      settings = await db.systemSettings.update({
        where: { id: settings.id },
        data: updateData
      });
    }

    // Audit logging
    await logAction({
      entityType: 'SYSTEM',
      entityId: 'SETTINGS',
      action: 'UPDATE',
      details: `Updated system settings`,
      userId: req.user.id,
      performedBy: req.user.displayName
    });

    res.json(settings);
  })
);

// ===================== SYSTEM STATUS =====================

/**
 * @route GET /admin/system/status
 * @summary Get system status and statistics
 * @security bearerAuth
 * @returns {Object} System statistics
 */
router.get(
  '/admin/system/status',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const [
      totalUsers,
      totalCustomers,
      totalRequests,
      totalMachines,
      totalBranches,
      openRequests,
      recentLogs
    ] = await Promise.all([
      db.user.count(ensureBranchWhere({}, req)),
      db.customer.count(ensureBranchWhere({}, req)),
      db.maintenanceRequest.count(ensureBranchWhere({}, req)),
      db.posMachine.count(ensureBranchWhere({}, req)),
      db.branch.count(), // Branches are global
      db.maintenanceRequest.count(ensureBranchWhere({ where: { status: 'Open' } }, req)),
      db.systemLog.count(ensureBranchWhere({
        where: {
          createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) }
        }
      }, req))
    ]);

    res.json({
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      statistics: {
        totalUsers,
        totalCustomers,
        totalRequests,
        totalMachines,
        totalBranches,
        openRequests,
        activityLast24h: recentLogs
      },
      database: {
        connected: true,
        status: 'operational'
      },
      memory: {
        used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
        total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024)
      }
    });
  })
);

/**
 * @route GET /admin/system/logs/recent
 * @summary Get recent system activity logs
 * @security bearerAuth
 * @queryParam {number} hours - Last N hours
 * @returns {Array} Recent logs
 */
router.get(
  '/admin/system/logs/recent',
  authenticateToken,
  requireAdmin,
  asyncHandler(async (req, res) => {
    const hours = Math.min(parseInt(req.query.hours) || 24, 168); // Max 7 days
    const cutoffTime = new Date(Date.now() - hours * 60 * 60 * 1000);

    const logs = await db.systemLog.findMany({
      where: {
        createdAt: { gte: cutoffTime }
      },
      orderBy: { createdAt: 'desc' },
      take: 500
    });

    res.json(logs);
  })
);

// ===================== BRANCH MANAGEMENT =====================

/**
 * @route GET /admin/branches
 * @summary Get all branches (super admin only)
 * @security bearerAuth
 * @returns {Array} List of branches
 */
router.get(
  '/admin/branches',
  authenticateToken,
  requireSuperAdmin,
  asyncHandler(async (req, res) => {
    const branches = await db.branch.findMany({
      include: {
        _count: {
          select: {
            users: true,
            customers: true
          }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json(branches);
  })
);

/**
 * @route POST /admin/branches
 * @summary Create new branch (super admin only)
 * @security bearerAuth
 * @body {Object} Branch data
 * @returns {Object} Created branch
 */
router.post(
  '/admin/branches',
  authenticateToken,
  requireSuperAdmin,
  createLimiter,
  validateRequest(createBranchSchema),
  asyncHandler(async (req, res) => {
    const validated = req.validated;

    // Check if branch code already exists (if provided)
    if (validated.code) {
      const existing = await db.branch.findFirst({
        where: { code: validated.code }
      });

      if (existing) {
        throw new AppError('Branch code already exists', 409, 'DUPLICATE_BRANCH_CODE');
      }
    }

    // Create branch
    const branch = await db.branch.create({
      data: {
        name: validated.name,
        location: validated.location,
        manager: validated.manager,
        phone: validated.phone,
        address: validated.address,
        code: validated.code || null
      }
    });

    // Audit logging
    await logAction({
      entityType: 'BRANCH',
      entityId: branch.id,
      action: 'CREATE',
      details: `Created branch: ${branch.name}`,
      userId: req.user.id,
      performedBy: req.user.displayName
    });

    res.status(201).json(branch);
  })
);

/**
 * @route PUT /admin/branches/:id
 * @summary Update branch (super admin only)
 * @security bearerAuth
 * @param {string} id - Branch ID
 * @body {Object} Updated branch data
 * @returns {Object} Updated branch
 */
router.put(
  '/admin/branches/:id',
  authenticateToken,
  requireSuperAdmin,
  updateLimiter,
  validateRequest(updateBranchSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;

    // Find existing
    const existing = await db.branch.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundError('Branch');
    }

    // Build update data
    const updateData = {};
    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });

    // Update
    const updated = await db.branch.update({
      where: { id },
      data: updateData
    });

    // Audit logging
    await logAction({
      entityType: 'BRANCH',
      entityId: id,
      action: 'UPDATE',
      details: `Updated branch: ${updated.name}`,
      userId: req.user.id,
      performedBy: req.user.displayName
    });

    res.json(updated);
  })
);

module.exports = router;
