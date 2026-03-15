const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');
const { getBranchFilter, isGlobalRole } = require('../../middleware/permissions');
const { success, error, paginated } = require('../../utils/apiResponse');
const { ROLES } = require('../../utils/constants');
const { ensureBranchWhere } = require('../../prisma/branchHelpers');
const { validateRequest } = require('../../middleware/validation');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

const createSimSchema = z.object({
    serialNumber: z.string().min(1),
    type: z.string().optional(),
    networkType: z.string().optional(),
    status: z.enum(['ACTIVE', 'DEFECTIVE', 'IN_TRANSIT']).optional(),
    notes: z.string().optional(),
    branchId: z.string().optional()
});

const updateSimSchema = z.object({
    serialNumber: z.string().min(1).optional(),
    type: z.string().optional(),
    networkType: z.string().optional(),
    status: z.enum(['ACTIVE', 'DEFECTIVE', 'IN_TRANSIT']).optional(),
    notes: z.string().optional()
});

// Pagination helpers removed

// GET all warehouse SIMs - PAGINATED
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { type, status, q } = req.query;
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const branchFilter = getBranchFilter(req);
    const targetBranchId = req.query.branchId;
    const where = { ...branchFilter };

    if (targetBranchId && (isGlobalRole(req.user.role))) {
        where.branchId = targetBranchId;
    }

    if (type) where.type = type;
    if (status) where.status = status;
    if (q) where.serialNumber = { contains: q };

    const [sims, total] = await Promise.all([
        db.warehouseSim.findMany({
            where,
            orderBy: { importDate: 'desc' },
            include: { branch: true },
            take: limit,
            skip: offset
        }),
        db.warehouseSim.count({ where })
    ]);

    return paginated(res, sims, total, limit, offset);
}));

// GET SIM movements
router.get('/movements', authenticateToken, asyncHandler(async (req, res) => {
    const { serialNumber } = req.query;
    const branchFilter = getBranchFilter(req);
    const targetBranchId = req.query.branchId;
    const where = { ...branchFilter };

    if (targetBranchId && (isGlobalRole(req.user.role))) {
        where.branchId = targetBranchId;
    }

    if (serialNumber) {
        where.serialNumber = serialNumber;
    }

    const logs = await db.simMovementLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        include: { Branch: true }
    });

    // Extract customer IDs and fetch customer names
    const enrichedLogs = await Promise.all(logs.map(async (log) => {
        let detailsObj = {};
        try {
            detailsObj = JSON.parse(log.details || '{}');
        } catch (e) { }

        let customerName = null;
        if (detailsObj.customerId) {
            const customer = await db.customer.findUnique({ where: { id: detailsObj.customerId } });
            if (customer) {
                customerName = customer.client_name;
            }
        }

        // Also support old structures or fallback
        return {
            ...log,
            customerName
        };
    }));

    return success(res, enrichedLogs);
}));

// GET counts
router.get('/counts', authenticateToken, asyncHandler(async (req, res) => {
    const branchFilter = getBranchFilter(req);
    const targetBranchId = req.query.branchId;
    const where = { ...branchFilter };
    if (targetBranchId && (isGlobalRole(req.user.role))) where.branchId = targetBranchId;

    const [statusCounts, typeCounts] = await Promise.all([
        db.warehouseSim.groupBy({ by: ['status'], where, _count: true }),
        db.warehouseSim.groupBy({ by: ['type'], where, _count: true })
    ]);

    const result = { total: 0, byStatus: {}, byType: {} };
    statusCounts.forEach(c => {
        const count = c._count._all || c._count;
        result[c.status] = count; // Flatten status keys for frontend (e.g., ACTIVE: 45)
        result.byStatus[c.status] = count;
        result.total += count;
    });

    typeCounts.forEach(c => {
        const count = c._count._all || c._count;
        result.byType[c.type || 'Unknown'] = count;
    });

    return success(res, result);
}));

// POST create
router.post('/', authenticateToken, validateRequest(createSimSchema), asyncHandler(async (req, res) => {
    const { serialNumber, type, networkType, status, notes } = req.body;
    const branchId = req.user.branchId || req.body.branchId;
    if (!branchId) return error(res, 'Branch ID required', 400);

    const sim = await db.warehouseSim.create({
        data: {
            branchId,
            serialNumber,
            type: type || null,
            networkType: networkType || null,
            status: status || 'ACTIVE',
            notes: notes || null
        }
    });
    return success(res, sim, 201);
}));

// PUT update
router.put('/:id', authenticateToken, validateRequest(updateSimSchema), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { serialNumber, type, networkType, status, notes } = req.body;
    const existing = await db.warehouseSim.findUnique({ where: { id } });
    if (!existing) return error(res, 'SIM not found', 404);
    if (req.user.branchId && existing.branchId !== req.user.branchId) return error(res, 'Access denied', 403);

    const sim = await db.warehouseSim.update({
        where: { id },
        data: { serialNumber, type, networkType, status, notes }
    });
    return success(res, sim);
}));

// DELETE
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const existing = await db.warehouseSim.findUnique({ where: { id: req.params.id } });
    if (existing) {
        if (req.user.branchId && existing.branchId !== req.user.branchId) return error(res, 'Access denied', 403);
        await db.warehouseSim.delete({ where: { id: req.params.id } });
    }
    return success(res, { success: true });
}));

module.exports = router;
