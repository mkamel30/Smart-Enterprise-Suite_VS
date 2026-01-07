const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errorHandler');
const { z } = require('zod');
const { validateQuery } = require('../middleware/validation');
const { getBranchFilter } = require('../middleware/permissions');

// Validation
const listQuerySchema = z.object({
  branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
  search: z.string().max(100).optional()
});

/**
 * @route GET /api/technicians
 * @summary Get all maintenance-capable users (Technicians)
 */
router.get('/', authenticateToken, validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const { branchId, search } = req.query;

  // Base filter: Must be able to do maintenance
  const where = {
    canDoMaintenance: true
  };

  // Branch filter
  const branchFilter = getBranchFilter(req.user);
  Object.assign(where, branchFilter);

  // Super admin override or specific branch request
  if (branchId && req.user.role === 'SUPER_ADMIN') {
    where.branchId = branchId;
  }

  // Search
  if (search) {
    where.OR = [
      { displayName: { contains: search } },
      { email: { contains: search } }
    ];
  }

  // Fetch technicians
  const technicians = await db.user.findMany({
    where,
    select: {
      id: true,
      displayName: true,
      email: true,
      role: true,
      branchId: true,

    },
    orderBy: { displayName: 'asc' }
  });

  res.json(technicians); // Returns array directly as expected by typical list endpoints used in dropdowns
}));

module.exports = router;
