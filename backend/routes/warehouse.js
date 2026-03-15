const express = require('express');
const router = express.Router();
const db = require('../db');

const { parsePaginationParams, createPaginationResponse } = require('../utils/pagination');
const { authenticateToken } = require('../middleware/auth');
const { logAction } = require('../utils/logger');
const { success, error } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

// GET spare parts (mounted at /api/spare-parts, so path is just '/')
router.get('/', authenticateToken, asyncHandler(async (req, res) => {
    const { limit, offset } = parsePaginationParams(req.query);
    const search = req.query.search || '';

    const where = {};
    if (search) {
        where.OR = [
            { name: { contains: search } },
            { partNumber: { contains: search } },
            { description: { contains: search } },
            { compatibleModels: { contains: search } }
        ];
    }

    const [parts, total] = await Promise.all([
        db.sparePart.findMany({
            where,
            include: {
                inventoryItems: true
            },
            take: limit,
            skip: offset,
            orderBy: { partNumber: 'asc' }
        }),
        db.sparePart.count({ where })
    ]);

    return success(res, createPaginationResponse(parts, total, limit, offset));
}));

// POST create spare part (with auto-generated part number)
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    // Get count for auto-generated part number
    const count = await db.sparePart.count();
    const partNumber = `SP${String(count + 1).padStart(4, '0')}`; // SP0001, SP0002, etc.
    if (!req.body || !req.body.name) return error(res, 'name is required', 400);

    const part = await db.sparePart.create({
        data: {
            partNumber: partNumber,
            name: String(req.body.name),
            description: req.body.description || '',
            compatibleModels: req.body.compatibleModels || '',
            defaultCost: req.body.defaultCost ? parseFloat(req.body.defaultCost) : 0,
            isConsumable: req.body.isConsumable === 'true' || req.body.isConsumable === true,
            allowsMultiple: req.body.allowsMultiple === 'true' || req.body.allowsMultiple === true
        }
    });

    // Log action
    await logAction({
        entityType: 'SPARE_PART',
        entityId: part.id,
        action: 'CREATE',
        details: { name: part.name, cost: part.defaultCost },
        userId: req.user.id,
        performedBy: req.user.displayName || req.user.email,
        branchId: req.user.branchId
    });

    return success(res, part, 201);
}));

// PUT update spare part (with price logging)
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
    // Get current part to check price change
    const currentPart = await db.sparePart.findUnique({
        where: { id: req.params.id }
    });

    if (!currentPart) {
        return error(res, 'Part not found', 404);
    }

    // Log price change if price changed
    if (req.body.defaultCost !== undefined &&
        req.body.defaultCost !== currentPart.defaultCost) {
        await db.priceChangeLog.create({
            data: {
                partId: req.params.id,
                oldCost: currentPart.defaultCost,
                newCost: req.body.defaultCost,
                changedAt: new Date(),
                userId: req.user.id || null
            }
        });
    }

    const part = await db.sparePart.update({
        where: { id: req.params.id },
        data: {
            partNumber: req.body.partNumber,
            name: req.body.name,
            description: req.body.description,
            compatibleModels: req.body.compatibleModels,
            defaultCost: req.body.defaultCost,
            isConsumable: req.body.isConsumable,
            allowsMultiple: req.body.allowsMultiple
        }
    });

    // Log action
    await logAction({
        entityType: 'SPARE_PART',
        entityId: part.id,
        action: 'UPDATE',
        details: { name: part.name, changes: req.body },
        userId: req.user.id,
        performedBy: req.user.displayName || req.user.email,
        branchId: req.user.branchId
    });

    return success(res, part);
}));

// GET price change logs for a part
router.get('/:id/price-logs', authenticateToken, asyncHandler(async (req, res) => {
    try {
        const logs = await db.priceChangeLog.findMany({
            where: { partId: req.params.id },
            orderBy: { changedAt: 'desc' }
        });
        res.json(logs);
    } catch (error) {
        console.error('Failed to fetch price logs:', error);
        res.status(500).json({ error: 'Failed to fetch price logs' });
    }
}));


// POST bulk delete spare parts
router.post('/bulk-delete', authenticateToken, asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return error(res, 'ids array required', 400);
    }

    // 1. Delete price logs
    await db.priceChangeLog.deleteMany({
        where: { partId: { in: ids } }
    });

    // 2. Delete stock movements (bypass branch enforcer)
    await db.stockMovement.deleteMany({
        where: {
            partId: { in: ids },
            branchId: { not: 'GLOBAL_DELETE' }
        }
    });

    // 3. Delete inventory items (bypass branch enforcer)
    await db.inventoryItem.deleteMany({
        where: {
            partId: { in: ids },
            branchId: { not: 'GLOBAL_DELETE' }
        }
    });

    // 4. Delete parts
    const result = await db.sparePart.deleteMany({
        where: { id: { in: ids } }
    });

    // Log action
    await logAction({
        entityType: 'SPARE_PART',
        entityId: 'BULK',
        action: 'BULK_DELETE',
        details: { count: result.count, ids },
        userId: req.user.id,
        performedBy: req.user.displayName || req.user.email,
        branchId: req.user.branchId
    });

    return success(res, { success: true, count: result.count });
}));

// POST import spare parts (with duplicate check)
router.post('/import', authenticateToken, asyncHandler(async (req, res) => {
    const { parts } = req.body;
    if (!Array.isArray(parts)) return error(res, 'parts array required', 400);

    const results = {
        created: 0,
        skipped: 0,
        errors: 0
    };

    for (const part of parts) {
        try {
            // Check if part exists by name (case insensitive)
            const existing = await db.sparePart.findFirst({
                where: {
                    name: {
                        equals: String(part.name).trim(),
                    }
                }
            });

            if (existing) {
                results.skipped++;
                continue;
            }

            const count = await db.sparePart.count();
            const partNumber = `SP${String(count + 1 + results.created).padStart(4, '0')}`;

            await db.sparePart.create({
                data: {
                    partNumber: partNumber,
                    name: String(part.name),
                    description: part.description || '',
                    compatibleModels: part.compatibleModels || '',
                    defaultCost: parseFloat(part.defaultCost) || 0,
                    isConsumable: part.isConsumable === 'true' || part.isConsumable === true,
                    allowsMultiple: part.allowsMultiple === 'true' || part.allowsMultiple === true
                }
            });
            results.created++;
        } catch (err) {
            console.error('Error importing part:', part.name, err);
            results.errors++;
        }
    }

    // Log action
    if (results.created > 0) {
        await logAction({
            entityType: 'SPARE_PART',
            entityId: 'IMPORT',
            action: 'IMPORT',
            details: results,
            userId: req.user.id,
            performedBy: req.user.displayName || req.user.email,
            branchId: req.user.branchId
        });
    }

    return success(res, results, 201);
}));

/**
 * GET Export Spare Parts to Excel
 */
const { exportToExcel } = require('../utils/excel');
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
    const parts = await db.sparePart.findMany({
        include: { inventoryItems: true }
    });

    const data = parts.map(p => ({
        'رقم القطعة': p.partNumber || '-',
        'الاسم': p.name || '-',
        'الوصف': p.description || '-',
        'الموديلات المتوافقة': p.compatibleModels || '-',
        'السعر الافتراضي': p.defaultCost || 0,
        'استهلاكي': p.isConsumable ? 'نعم' : 'لا',
        'يسمح بالتكرار': p.allowsMultiple ? 'نعم' : 'لا',
        'إجمالي المخزون': p.inventoryItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    }));

    const columns = [
        { header: 'رقم القطعة', key: 'رقم القطعة', width: 15 },
        { header: 'الاسم', key: 'الاسم', width: 30 },
        { header: 'الوصف', key: 'الوصف', width: 30 },
        { header: 'الموديلات المتوافقة', key: 'الموديلات المتوافقة', width: 25 },
        { header: 'السعر الافتراضي', key: 'السعر الافتراضي', width: 15 },
        { header: 'استهلاكي', key: 'استهلاكي', width: 10 },
        { header: 'يسمح بالتكرار', key: 'يسمح بالتكرار', width: 12 },
        { header: 'إجمالي المخزون', key: 'إجمالي المخزون', width: 15 }
    ];

    const buffer = await exportToExcel(data, columns, 'spare_parts_export');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=spare_parts_export.xlsx');
    res.send(buffer);
}));

module.exports = router;

