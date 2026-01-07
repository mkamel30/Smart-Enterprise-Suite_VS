const express = require('express');
const router = express.Router();
const { z } = require('zod');
const bcrypt = require('bcryptjs');

// Database
const db = require('../db');

// Middleware
const { authenticateToken, requireManager, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { createLimiter, updateLimiter, deleteLimiter } = require('../middleware/rateLimits');

// Utilities
const { asyncHandler, AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');
const logger = require('../utils/logger');

// ===================== VALIDATION SCHEMAS =====================

const listQuerySchema = z.object({
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  role: z.enum(['TECHNICIAN', 'SUPERVISOR', 'MANAGER', 'CENTER_MANAGER', 'ADMIN', 'SUPER_ADMIN']).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100).optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0).optional().default('0'),
  sortBy: z.enum(['displayName', 'email', 'role', 'createdAt']).default('displayName'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().max(100).optional()
});

const createTechnicianSchema = z.object({
  displayName: z.string().min(2, 'Name required').max(100),
  email: z.string().email('Valid email required'),
  password: z.string().min(8, 'Password must be at least 8 characters').regex(/[A-Z]/, 'Must contain uppercase').regex(/[0-9]/, 'Must contain number'),
  role: z.enum(['TECHNICIAN', 'SUPERVISOR', 'MANAGER', 'CENTER_MANAGER']),
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  canDoMaintenance: z.boolean().optional().default(true),
  phoneNumber: z.string().regex(/^[0-9\+\-\s]{1,20}$/).optional()
});

const updateTechnicianSchema = z.object({
  displayName: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  role: z.enum(['TECHNICIAN', 'SUPERVISOR', 'MANAGER', 'CENTER_MANAGER']).optional(),
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  canDoMaintenance: z.boolean().optional(),
  phoneNumber: z.string().regex(/^[0-9\+\-\s]{1,20}$/).optional()
});

const passwordResetSchema = z.object({
  newPassword: z.string().min(8).regex(/[A-Z]/).regex(/[0-9]/)
});

const idParamSchema = z.object({
  id: z.string().regex(/^[a-z0-9]{25}$/)
});

// ===================== HELPER FUNCTIONS =====================

/**
 * Build where clause with proper filtering
 */
const buildWhereClause = (validated, user) => {
  const where = {};
  
  // Apply branch filter for non-super-admins
  const branchFilter = getBranchFilter(user);
  Object.assign(where, branchFilter);
  
  // Super-admin branch filtering
  if (validated.branchId) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new AppError('Only super admins can filter by branch', 403, 'FORBIDDEN');
    }
    where.branchId = validated.branchId;
  }
  
  // Role filtering
  if (validated.role) {
    where.role = validated.role;
  }
  
  // Search by name or email
  if (validated.search && validated.search.trim()) {
    const searchTerm = validated.search.trim();
    where.OR = [
      { displayName: { contains: searchTerm, mode: 'insensitive' } },
      { email: { contains: searchTerm, mode: 'insensitive' } }
    ];
  }
  
  return where;
};

// ===================== GET ALL TECHNICIANS/USERS =====================
/**
 * @route GET /technicians
 * @summary Get all technicians/maintenance users with pagination
 * @security bearerAuth
 * @queryParam {number} limit - Results per page
 * @queryParam {number} offset - Page offset
 * @returns {Object} Paginated technician list
 */
router.get(
  '/technicians',
  authenticateToken,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const validated = req.query;
    
    // Build filter - only get maintenance-capable users
    const where = {
      canDoMaintenance: true
    };
    
    // Apply branch filter
    const branchFilter = getBranchFilter(req.user);
    Object.assign(where, branchFilter);
    
    if (validated.branchId && req.user.role === 'SUPER_ADMIN') {
      where.branchId = validated.branchId;
    }
    
    // Safe pagination
    const limit = Math.min(validated.limit, 100);
    const offset = Math.max(0, validated.offset);
    
    // Fetch in parallel
    const [technicians, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          branchId: true,
          phoneNumber: true,
          createdAt: true
        },
        orderBy: { [validated.sortBy]: validated.sortOrder },
        take: limit,
        skip: offset
      }),
      db.user.count({ where })
    ]);
    
    res.json({
      data: technicians,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    });
  })
);

// ===================== GET ALL USERS =====================
/**
 * @route GET /users
 * @summary Get all users (admins only)
 * @security bearerAuth
 * @queryParam {number} limit - Results per page
 * @queryParam {number} offset - Page offset
 * @returns {Object} Paginated user list
 */
router.get(
  '/users',
  authenticateToken,
  requireAdmin,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const validated = req.query;
    
    const where = buildWhereClause(validated, req.user);
    
    const limit = Math.min(validated.limit, 100);
    const offset = Math.max(0, validated.offset);
    
    const [users, total] = await Promise.all([
      db.user.findMany({
        where,
        select: {
          id: true,
          displayName: true,
          email: true,
          role: true,
          branchId: true,
          canDoMaintenance: true,
          phoneNumber: true,
          createdAt: true
        },
        orderBy: { [validated.sortBy]: validated.sortOrder },
        take: limit,
        skip: offset
      }),
      db.user.count({ where })
    ]);
    
    res.json({
      data: users,
      pagination: { total, limit, offset, pages: Math.ceil(total / limit) }
    });
  })
);

// ===================== GET SINGLE USER =====================
/**
 * @route GET /users/:id
 * @summary Get specific user details
 * @security bearerAuth
 * @param {string} id - User ID
 * @returns {Object} User details
 */
router.get(
  '/users/:id',
  authenticateToken,
  requireManager,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    
    const user = await db.user.findUnique({
      where: { id },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        branchId: true,
        canDoMaintenance: true,
        phoneNumber: true,
        createdAt: true
      }
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    // Branch isolation
    if (req.user.branchId && user.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    
    res.json(user);
  })
);

// ===================== CREATE USER =====================
/**
 * @route POST /users
 * @summary Create new user/technician
 * @security bearerAuth
 * @body {Object} User data
 * @returns {Object} Created user
 */
router.post(
  '/users',
  authenticateToken,
  requireManager,
  createLimiter,
  validateRequest(createTechnicianSchema),
  asyncHandler(async (req, res) => {
    const validated = req.validated;
    
    // Check if email already exists
    const existing = await db.user.findUnique({
      where: { email: validated.email }
    });
    
    if (existing) {
      throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
    }
    
    // Determine branch
    const branchId = req.user.branchId || validated.branchId;
    if (!branchId && !req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Branch ID is required', 400, 'MISSING_BRANCH');
    }
    
    // Hash password
    const hashedPassword = await bcrypt.hash(validated.password, 10);
    
    // Create user
    const user = await db.user.create({
      data: {
        displayName: validated.displayName,
        email: validated.email,
        password: hashedPassword,
        role: validated.role,
        branchId,
        canDoMaintenance: validated.canDoMaintenance,
        phoneNumber: validated.phoneNumber
      },
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        branchId: true
      }
    });
    
    // Audit logging
    await logAction({
      entityType: 'USER',
      entityId: user.id,
      action: 'CREATE',
      details: `Created user: ${user.displayName} (${user.role})`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: branchId || req.user.branchId
    });
    
    res.status(201).json(user);
  })
);

// ===================== UPDATE USER =====================
/**
 * @route PUT /users/:id
 * @summary Update user details
 * @security bearerAuth
 * @param {string} id - User ID
 * @body {Object} Updated user data
 * @returns {Object} Updated user
 */
router.put(
  '/users/:id',
  authenticateToken,
  requireManager,
  updateLimiter,
  validateRequest(updateTechnicianSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;
    
    // Find existing
    const existing = await db.user.findUnique({
      where: { id }
    });
    
    if (!existing) {
      throw new NotFoundError('User');
    }
    
    // Branch isolation
    if (req.user.branchId && existing.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    
    // Check email uniqueness if changing
    if (validated.email && validated.email !== existing.email) {
      const duplicate = await db.user.findUnique({
        where: { email: validated.email }
      });
      if (duplicate) {
        throw new AppError('Email already in use', 409, 'DUPLICATE_EMAIL');
      }
    }
    
    // Build update data
    const updateData = {};
    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });
    
    // Update
    const updated = await db.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        displayName: true,
        email: true,
        role: true,
        branchId: true,
        canDoMaintenance: true
      }
    });
    
    // Audit logging
    await logAction({
      entityType: 'USER',
      entityId: id,
      action: 'UPDATE',
      details: `Updated user: ${updated.displayName}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: req.user.branchId
    });
    
    res.json(updated);
  })
);

// ===================== RESET USER PASSWORD =====================
/**
 * @route POST /users/:id/reset-password
 * @summary Reset user password (admin only)
 * @security bearerAuth
 * @param {string} id - User ID
 * @body {Object} New password
 * @returns {Object} Success message
 */
router.post(
  '/users/:id/reset-password',
  authenticateToken,
  requireManager,
  validateRequest(passwordResetSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const { newPassword } = req.validated;
    
    // Find user
    const user = await db.user.findUnique({
      where: { id }
    });
    
    if (!user) {
      throw new NotFoundError('User');
    }
    
    // Branch isolation
    if (req.user.branchId && user.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    
    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    
    // Update
    await db.user.update({
      where: { id },
      data: { password: hashedPassword }
    });
    
    // Audit logging
    await logAction({
      entityType: 'USER',
      entityId: id,
      action: 'PASSWORD_RESET',
      details: `Password reset by admin`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branch
