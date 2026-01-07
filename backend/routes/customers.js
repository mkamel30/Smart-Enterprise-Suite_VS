const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { z } = require('zod');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { getBranchFilter } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { logAction } = require('../utils/logger');

// Validation Schemas
const customerSchema = z.object({
  client_name: z.string().min(2, 'Name is required'),
  bkcode: z.string().min(1, 'Code is required'), // Assuming bkcode is required
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
  branchId: z.string().optional()
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(50),
  offset: z.coerce.number().min(0).default(0)
});

// GET /lite - Dropdown list (Critical for frontend)
router.get('/lite', authenticateToken, asyncHandler(async (req, res) => {
  const where = getBranchFilter(req);

  if (req.query.search) {
    where.OR = [
      { client_name: { contains: req.query.search } },
      { bkcode: { contains: req.query.search } }
    ];
  }

  const customers = await db.customer.findMany(ensureBranchWhere({
    where,
    select: {
      id: true,
      client_name: true,
      bkcode: true
    },
    take: 50,
    orderBy: { client_name: 'asc' }
  }, req));

  res.json(customers);
}));

// GET / - List all customers with pagination
router.get('/', authenticateToken, validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const { search, limit, offset } = req.query;
  const where = getBranchFilter(req);

  if (search) {
    where.OR = [
      { client_name: { contains: search } },
      { bkcode: { contains: search } },
      { phone: { contains: search } },
      { mobile: { contains: search } }
    ];
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany(ensureBranchWhere({
      where,
      include: { branch: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset
    }, req)),
    db.customer.count(ensureBranchWhere({ where }, req))
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
}));

// GET /:id - Customer details
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const customer = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id },
    include: {
      branch: { select: { name: true } },
      simCards: true,
      posMachines: true
    }
  }, req));

  if (!customer) throw new AppError('Customer not found', 404);
  res.json(customer);
}));

// POST / - Create customer
router.post('/', authenticateToken, validateRequest(customerSchema), asyncHandler(async (req, res) => {
  const { client_name, bkcode, phone, mobile, address } = req.body;
  const branchId = req.user.branchId || req.body.branchId;

  if (!branchId && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Branch ID is required', 400);
  }

  // Check duplicate bkcode
  const existing = await db.customer.findFirst({
    where: { bkcode, branchId }
  });
  if (existing) throw new AppError('Customer code already exists in this branch', 409);

  const customer = await db.customer.create({
    data: {
      client_name,
      bkcode,
      phone: phone || null,
      mobile: mobile || null,
      address: address || null,
      branchId
    }
  });

  await logAction({
    entityType: 'CUSTOMER',
    entityId: customer.id,
    action: 'CREATE',
    details: { name: customer.client_name, code: customer.bkcode },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId
  });

  res.status(201).json(customer);
}));

// PUT /:id - Update customer
router.put('/:id', authenticateToken, validateRequest(customerSchema.partial()), asyncHandler(async (req, res) => {
  const existing = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id }
  }, req));

  if (!existing) throw new AppError('Customer not found', 404);

  const updateData = req.body;

  // Prevent updating branchId if not admin? (Usually not allowed to move customers easily)
  if (req.user.role !== 'SUPER_ADMIN') {
    delete updateData.branchId;
  }

  const customer = await db.customer.update({
    where: { id: req.params.id },
    data: updateData
  });

  await logAction({
    entityType: 'CUSTOMER',
    entityId: customer.id,
    action: 'UPDATE',
    details: { changes: Object.keys(updateData) },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId: customer.branchId
  });

  res.json(customer);
}));

// DELETE /:id - Delete customer
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  // Check permissions
  if (!['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER'].includes(req.user.role)) {
    throw new AppError('Access denied', 403);
  }

  const existing = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id }
  }, req));

  if (!existing) throw new AppError('Customer not found', 404);

  // Check relations (Prevent delete if has POS or SIMs)
  const hasData = await db.customer.findFirst({
    where: { id: req.params.id },
    include: { _count: { select: { posMachines: true, simCards: true } } }
  });

  if (hasData._count.posMachines > 0 || hasData._count.simCards > 0) {
    throw new AppError('Cannot delete customer with active devices', 400);
  }

  await db.customer.delete({ where: { id: req.params.id } });

  await logAction({
    entityType: 'CUSTOMER',
    entityId: req.params.id,
    action: 'DELETE',
    details: { name: existing.client_name },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId: existing.branchId
  });

  res.json({ success: true });
}));

module.exports = router;
