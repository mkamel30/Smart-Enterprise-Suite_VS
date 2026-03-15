const express = require('express');
const router = express.Router();
const { z } = require('zod');
const db = require('../../../../db');
const { logAction } = require('../../../../utils/logger');
const { authenticateToken } = require('../../../../middleware/auth');
const { getBranchFilter } = require('../../../../middleware/permissions');
const { validateQuery } = require('../../../../middleware/validation');
const { normalizeSerial } = require('../../shared/serial.service.js');
const warehouseService = require('../warehouse.service.js');
const movementService = require('../../shared/movement.service.js');
const { success, error, paginated } = require('../../../../utils/apiResponse');
const { ROLES, isGlobalRole } = require('../../../../utils/constants');
const { ensureBranchWhere } = require('../../../../prisma/branchHelpers');

const listQuerySchema = z.object({
    branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
    status: z.union([
        z.string(),
        z.array(z.string())
    ]).optional(),
    q: z.string().optional()
});

// Pagination helpers removed

// GET Machines by Status - PAGINATED
router.get('/', authenticateToken, validateQuery(listQuerySchema), async (req, res) => {
    try {
        const { status, q } = req.query;
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;
        const whereClause = { ...branchFilter };

        if (targetBranchId && (isGlobalRole(req.user.role))) {
            whereClause.branchId = targetBranchId;
        }

        if (status) {
            if (status === 'CLIENT_REPAIR') {
                whereClause.status = { in: ['CLIENT_REPAIR', 'AT_CENTER', 'EXTERNAL_REPAIR'] };
            } else if (Array.isArray(status)) {
                whereClause.status = { in: status };
            } else {
                whereClause.status = status;
            }
        }

        if (q) {
            whereClause.OR = [
                { serialNumber: { contains: q } },
                { model: { contains: q, mode: 'insensitive' } }
            ];
        }

        const pendingTransferSerials = await db.transferOrderItem.findMany({
            where: {
                transferOrder: { status: { in: ['PENDING', 'PARTIAL'] } }
            },
            select: { serialNumber: true }
        });

        const pendingSerialsList = pendingTransferSerials.map(item => item.serialNumber);
        if (pendingSerialsList.length > 0) {
            whereClause.serialNumber = { notIn: pendingSerialsList };
        }

        const [machines, total] = await Promise.all([
            db.warehouseMachine.findMany({
                where: whereClause,
                orderBy: { importDate: 'desc' },
                include: { branch: true },
                take: limit,
                skip: offset
            }),
            db.warehouseMachine.count({ where: whereClause })
        ]);

        return paginated(res, machines, total, limit, offset);
    } catch (err) {
        logAction('Failed to fetch warehouse machines: ' + err.message, req);
        return error(res, 'فشل في جلب الماكينات');
    }
});

// GET Machine Counts
router.get('/counts', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;
        const whereClause = { ...branchFilter };

        if (targetBranchId && (isGlobalRole(req.user.role))) {
            whereClause.branchId = targetBranchId;
        }

        const counts = await db.warehouseMachine.groupBy({
            by: ['status'],
            where: whereClause,
            _count: { status: true }
        });

        const formattedCounts = counts.reduce((acc, curr) => {
            acc[curr.status] = curr._count.status;
            return acc;
        }, {});

        return success(res, formattedCounts);
    } catch (err) {
        console.error('Failed to fetch machine counts:', err);
        return error(res, 'فشل في جلب الإحصائيات');
    }
});

// GET Duplicated
router.get('/duplicates', authenticateToken, async (_req, res) => {
    try {
        if (![ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.ADMIN_AFFAIRS].includes(_req.user.role)) {
            return error(res, 'Access denied', 403);
        }

        const [warehouse, pos] = await Promise.all([
            db.warehouseMachine.findMany({
                where: { branchId: { not: null } },
                include: { branch: true }
            }),
            db.posMachine.findMany({
                where: { branchId: { not: null } },
                include: { customer: { include: { branch: true } } }
            })
        ]);

        const map = new Map();
        const push = (serial, entry) => {
            const key = normalizeSerial(serial);
            if (!key) return;
            if (!map.has(key)) map.set(key, []);
            map.get(key).push(entry);
        };

        for (const m of warehouse) {
            push(m.serialNumber, {
                source: 'WAREHOUSE',
                id: m.id,
                branchId: m.branchId,
                branchName: m.branch?.name || null,
                status: m.status,
                model: m.model,
                manufacturer: m.manufacturer
            });
        }

        for (const p of pos) {
            push(p.serialNumber, {
                source: 'CUSTOMER',
                id: p.id,
                customerId: p.customerId,
                customerName: p.customer?.client_name || null,
                branchId: p.customer?.branchId || p.branchId || null,
                branchName: p.customer?.branch?.name || null
            });
        }

        const duplicates = [];
        for (const [serialNumber, occurrences] of map.entries()) {
            if (occurrences.length > 1) {
                duplicates.push({ serialNumber, count: occurrences.length, occurrences });
            }
        }

        duplicates.sort((a, b) => b.count - a.count || a.serialNumber.localeCompare(b.serialNumber));
        return success(res, { duplicates, totalDuplicates: duplicates.length });
    } catch (err) {
        console.error('Failed to fetch duplicate machines:', err);
        return error(res, 'فشل في جلب التكرارات');
    }
});

// GET Logs
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const logs = await db.machineMovementLog.findMany({
            where: branchFilter,
            orderBy: { createdAt: 'desc' },
            take: 100
        });
        return success(res, logs);
    } catch (err) {
        console.error('Failed to fetch machine logs:', err);
        return error(res, 'Failed to fetch logs');
    }
});

// POST Create One
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { performedBy = 'System', ...data } = req.body;
        const machine = await warehouseService.createMachine({ ...data, performedBy }, req.user);
        return success(res, machine);
    } catch (err) {
        return error(res, err.message || 'Creation failed', err.status || 400);
    }
});

// PUT Update status/notes
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { performedBy = 'System', ...data } = req.body;
        const existing = await db.warehouseMachine.findUnique({
            where: { id: req.params.id }
        });

        if (!existing) return error(res, 'Machine not found', 404);
        if (req.user.branchId && existing.branchId !== req.user.branchId) {
            return error(res, 'Access denied', 403);
        }

        if (data.status === 'IN_TRANSIT' && existing.status !== 'IN_TRANSIT') {
            return error(res, 'لا يمكن تغيير الحالة إلى "قيد النقل" يدوياً. يجب إنشاء إذن تحويل.', 400);
        }

        if (data.status && data.status !== existing.status) {
            await movementService.logMachineMovement(db, {
                machineId: existing.id,
                serialNumber: existing.serialNumber,
                action: 'STATUS_CHANGE',
                details: `Changed from ${existing.status} to ${data.status}`,
                performedBy,
                branchId: existing.branchId
            });
        }

        const machine = await db.warehouseMachine.update({
            where: { id: req.params.id },
            data
        });
        return success(res, machine);
    } catch (err) {
        return error(res, 'Update failed', 400);
    }
});

// DELETE
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const machine = await db.warehouseMachine.findUnique({
            where: { id: req.params.id }
        });
        if (machine) {
            if (req.user.branchId && machine.branchId !== req.user.branchId) {
                return error(res, 'Access denied', 403);
            }
            await db.warehouseMachine.delete({
                where: { id: req.params.id }
            });
        }
        return success(res, { success: true });
    } catch (err) {
        return error(res, 'Delete failed');
    }
});

// PUT Update by prefix
router.put('/update-by-prefix', authenticateToken, async (req, res) => {
    try {
        const { prefix, model, manufacturer } = req.body;
        const branchFilter = getBranchFilter(req);
        if (!prefix || !model || !manufacturer) return error(res, 'prefix, model, and manufacturer are required', 400);

        const updateResult = await db.warehouseMachine.updateMany({
            where: {
                ...branchFilter,
                serialNumber: { startsWith: prefix },
                OR: [{ model: null }, { model: '' }, { model: '-' }]
            },
            data: { model: model.toUpperCase(), manufacturer: manufacturer.toUpperCase() }
        });

        return success(res, { success: true, updated: updateResult.count });
    } catch (err) {
        return error(res, 'Update failed');
    }
});

// GET Diagnostics
router.get('/diagnostics', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const warehouseMachines = await db.warehouseMachine.findMany({ where: branchFilter, select: { serialNumber: true, status: true, originalOwnerId: true } });
        const customerMachines = await db.posMachine.findMany({ where: req.user.branchId ? { customer: { branchId: req.user.branchId } } : {}, select: { serialNumber: true, customerId: true } });
        const customerSerials = new Set(customerMachines.map(m => m.serialNumber));
        const duplicates = warehouseMachines.filter(wm => customerSerials.has(wm.serialNumber)).map(wm => ({ serialNumber: wm.serialNumber, warehouseStatus: wm.status, currentCustomerId: customerMachines.find(cm => cm.serialNumber === wm.serialNumber)?.customerId }));
        return success(res, { warehouseCount: warehouseMachines.length, customerCount: customerMachines.length, duplicateCount: duplicates.length, duplicates });
    } catch (err) {
        return error(res, 'Failed');
    }
});

module.exports = router;
