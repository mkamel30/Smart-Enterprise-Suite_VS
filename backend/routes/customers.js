const express = require('express');
const router = express.Router();
const { z } = require('zod');
const multer = require('multer');
const ExcelJS = require('exceljs');

// Database and services
const db = require('../db');

// Middleware
const { authenticateToken, requireManager } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { createLimiter, updateLimiter, deleteLimiter, uploadLimiter } = require('../middleware/rateLimits');

// Utilities
const { asyncHandler, AppError, NotFoundError } = require('../utils/errorHandler');
const { logAction } = require('../utils/logger');
const logger = require('../utils/logger');

// ===================== VALIDATION SCHEMAS =====================

const listQuerySchema = z.object({
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  limit: z.string().regex(/^\d+$/).transform(Number).refine(n => n > 0 && n <= 100, 'Limit must be between 1 and 100').optional().default('50'),
  offset: z.string().regex(/^\d+$/).transform(Number).refine(n => n >= 0, 'Offset must be non-negative').optional().default('0'),
  sortBy: z.enum(['client_name', 'bkcode', 'telephone_1', 'createdAt']).default('client_name'),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
  search: z.string().max(50).optional()
});

const createCustomerSchema = z.object({
  bkcode: z.string().min(3, 'Customer code required').max(50),
  client_name: z.string().min(2, 'Customer name required').max(255),
  supply_office: z.string().max(255).optional(),
  operating_date: z.string().datetime().optional(),
  address: z.string().max(500).optional(),
  contact_person: z.string().max(100).optional(),
  scanned_id_path: z.string().max(500).optional(),
  national_id: z.string().max(20).optional(),
  dept: z.string().max(100).optional(),
  telephone_1: z.string().regex(/^[0-9\+\-\s]{1,20}$/).optional(),
  telephone_2: z.string().regex(/^[0-9\+\-\s]{1,20}$/).optional(),
  has_gates: z.boolean().optional().default(false),
  bk_type: z.string().max(50).optional(),
  clienttype: z.string().max(100).optional(),
  notes: z.string().max(1000).optional(),
  papers_date: z.string().datetime().optional(),
  isSpecial: z.boolean().optional().default(false),
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional()
});

const updateCustomerSchema = createCustomerSchema.partial();

const idParamSchema = z.object({
  id: z.string().min(3).max(50)
});

// ===================== MULTER CONFIG =====================

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB max
  fileFilter: (req, file, cb) => {
    if (!file.originalname.match(/\.(xlsx|xls)$/)) {
      return cb(new AppError('Only Excel files are allowed', 400, 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  }
});

// ===================== HELPER FUNCTIONS =====================

/**
 * Build where clause with proper search and filtering
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
  
  // Search functionality
  if (validated.search && validated.search.trim()) {
    const searchTerm = validated.search.trim();
    where.OR = [
      { client_name: { contains: searchTerm, mode: 'insensitive' } },
      { bkcode: { contains: searchTerm, mode: 'insensitive' } },
      { telephone_1: { contains: searchTerm } },
      { national_id: { contains: searchTerm } }
    ];
  }
  
  return where;
};

// ===================== GET ALL CUSTOMERS =====================
/**
 * @route GET /customers
 * @summary Get all customers with pagination and search
 * @security bearerAuth
 * @queryParam {number} limit - Results per page (max 100)
 * @queryParam {number} offset - Page offset
 * @queryParam {string} search - Search by name, code, phone
 * @returns {Object} Paginated customer list
 */
router.get(
  '/customers',
  authenticateToken,
  validateQuery(listQuerySchema),
  asyncHandler(async (req, res) => {
    const validated = req.query;
    
    // Build filter with security checks
    const where = buildWhereClause(validated, req.user);
    
    // Safe pagination
    const limit = Math.min(validated.limit, 100);
    const offset = Math.max(0, validated.offset);
    
    // Fetch data in parallel
    const [customers, total] = await Promise.all([
      db.customer.findMany({
        where,
        select: {
          bkcode: true,
          client_name: true,
          supply_office: true,
          telephone_1: true,
          telephone_2: true,
          address: true,
          national_id: true,
          contact_person: true,
          branchId: true,
          isSpecial: true,
          createdAt: true
        },
        orderBy: { [validated.sortBy]: validated.sortOrder },
        take: limit,
        skip: offset
      }),
      db.customer.count({ where })
    ]);
    
    res.json({
      data: customers,
      pagination: {
        total,
        limit,
        offset,
        pages: Math.ceil(total / limit)
      }
    });
  })
);

// ===================== GET CUSTOMER - LIGHTWEIGHT =====================
/**
 * @route GET /customers/lite/all
 * @summary Get lightweight customer list for dropdowns
 * @security bearerAuth
 * @returns {Array} Lightweight customer list
 */
router.get(
  '/customers/lite/all',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req.user);
    
    const customers = await db.customer.findMany({
      where: branchFilter,
      select: {
        bkcode: true,
        client_name: true
      },
      orderBy: { client_name: 'asc' },
      take: 1000 // Reasonable limit for dropdown
    });
    
    res.json(customers);
  })
);

// ===================== GET SINGLE CUSTOMER =====================
/**
 * @route GET /customers/:id
 * @summary Get specific customer with all details
 * @security bearerAuth
 * @param {string} id - Customer code (bkcode)
 * @returns {Object} Complete customer details
 */
router.get(
  '/customers/:id',
  authenticateToken,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    
    const customer = await db.customer.findUnique({
      where: { bkcode: id },
      include: {
        machines: {
          select: {
            id: true,
            serialNumber: true,
            model: true,
            manufacturer: true,
            status: true
          }
        },
        simCards: {
          select: {
            id: true,
            serialNumber: true,
            status: true
          }
        }
      }
    });
    
    if (!customer) {
      throw new NotFoundError('Customer');
    }
    
    // Branch isolation check
    if (req.user.branchId && customer.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    
    res.json(customer);
  })
);

// ===================== CREATE CUSTOMER =====================
/**
 * @route POST /customers
 * @summary Create new customer
 * @security bearerAuth
 * @body {Object} Customer data
 * @returns {Object} Created customer
 */
router.post(
  '/customers',
  authenticateToken,
  requireManager,
  createLimiter,
  validateRequest(createCustomerSchema),
  asyncHandler(async (req, res) => {
    const validated = req.validated;
    
    // Determine branch
    const branchId = req.user.branchId || validated.branchId;
    if (!branchId) {
      throw new AppError('Branch ID is required', 400, 'MISSING_BRANCH');
    }
    
    // Check if customer code already exists
    const existing = await db.customer.findUnique({
      where: { bkcode: validated.bkcode }
    });
    
    if (existing) {
      throw new AppError('Customer code already exists', 409, 'DUPLICATE_CUSTOMER');
    }
    
    // Create customer
    const customer = await db.customer.create({
      data: {
        branchId,
        bkcode: validated.bkcode,
        client_name: validated.client_name,
        supply_office: validated.supply_office,
        operating_date: validated.operating_date,
        address: validated.address,
        contact_person: validated.contact_person,
        scanned_id_path: validated.scanned_id_path,
        national_id: validated.national_id,
        dept: validated.dept,
        telephone_1: validated.telephone_1,
        telephone_2: validated.telephone_2,
        has_gates: validated.has_gates,
        bk_type: validated.bk_type,
        clienttype: validated.clienttype,
        notes: validated.notes,
        papers_date: validated.papers_date,
        isSpecial: validated.isSpecial
      }
    });
    
    // Audit logging
    await logAction({
      entityType: 'CUSTOMER',
      entityId: customer.bkcode,
      action: 'CREATE',
      details: `Created customer: ${customer.client_name}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId
    });
    
    res.status(201).json(customer);
  })
);

// ===================== UPDATE CUSTOMER =====================
/**
 * @route PUT /customers/:id
 * @summary Update customer details
 * @security bearerAuth
 * @param {string} id - Customer code
 * @body {Object} Updated customer data
 * @returns {Object} Updated customer
 */
router.put(
  '/customers/:id',
  authenticateToken,
  requireManager,
  updateLimiter,
  validateRequest(updateCustomerSchema),
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    const validated = req.validated;
    
    // Find existing
    const existing = await db.customer.findUnique({
      where: { bkcode: id }
    });
    
    if (!existing) {
      throw new NotFoundError('Customer');
    }
    
    // Branch isolation
    if (req.user.branchId && existing.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    
    // Prepare update data (only include provided fields)
    const updateData = {};
    Object.entries(validated).forEach(([key, value]) => {
      if (value !== undefined) {
        updateData[key] = value;
      }
    });
    
    // If changing bkcode, check for duplicates
    if (updateData.bkcode && updateData.bkcode !== existing.bkcode) {
      const duplicate = await db.customer.findUnique({
        where: { bkcode: updateData.bkcode }
      });
      if (duplicate) {
        throw new AppError('Customer code already exists', 409, 'DUPLICATE_CUSTOMER');
      }
    }
    
    // Update
    const updated = await db.customer.update({
      where: { bkcode: id },
      data: updateData
    });
    
    // Audit logging
    await logAction({
      entityType: 'CUSTOMER',
      entityId: id,
      action: 'UPDATE',
      details: `Updated customer: ${updated.client_name}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: req.user.branchId
    });
    
    res.json(updated);
  })
);

// ===================== DELETE CUSTOMER =====================
/**
 * @route DELETE /customers/:id
 * @summary Delete customer (with validation)
 * @security bearerAuth
 * @param {string} id - Customer code
 * @returns {Object} Success message
 */
router.delete(
  '/customers/:id',
  authenticateToken,
  requireManager,
  deleteLimiter,
  asyncHandler(async (req, res) => {
    const { id } = idParamSchema.parse(req.params);
    
    // Find customer
    const customer = await db.customer.findUnique({
      where: { bkcode: id }
    });
    
    if (!customer) {
      throw new NotFoundError('Customer');
    }
    
    // Branch isolation
    if (req.user.branchId && customer.branchId !== req.user.branchId && req.user.role !== 'SUPER_ADMIN') {
      throw new AppError('Access denied', 403, 'FORBIDDEN');
    }
    
    // Check if customer has associated records
    const machineCount = await db.posMachine.count({
      where: { customerId: id }
    });
    
    if (machineCount > 0) {
      throw new AppError('Cannot delete customer with active machines', 400, 'CUSTOMER_HAS_MACHINES');
    }
    
    // Delete
    await db.customer.delete({
      where: { bkcode: id }
    });
    
    // Audit logging
    await logAction({
      entityType: 'CUSTOMER',
      entityId: id,
      action: 'DELETE',
      details: `Deleted customer: ${customer.client_name}`,
      userId: req.user.id,
      performedBy: req.user.displayName,
      branchId: req.user.branchId
    });
    
    res.json({ message: 
