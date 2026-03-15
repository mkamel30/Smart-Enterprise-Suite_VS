const express = require('express');
const router = express.Router();
const db = require('../../../db');

const { parsePaginationParams, createPaginationResponse } = require('../../../utils/pagination');
const { authenticateToken } = require('../../../middleware/auth');
const { logAction } = require('../../../utils/logger');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');
const { importSpareParts } = require('../shared/importExport.service');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { exportToExcel, setExcelHeaders, generateExportFilename } = require('../../../utils/excel');

// GET spare parts
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
            include: { inventoryItems: true },
            take: limit,
            skip: offset,
            orderBy: { partNumber: 'asc' }
        }),
        db.sparePart.count({ where })
    ]);

    return success(res, createPaginationResponse(parts, total, limit, offset));
}));

// POST create spare part
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    const count = await db.sparePart.count();
    const partNumber = `SP${String(count + 1).padStart(4, '0')}`;
    if (!req.body || !req.body.name) return error(res, 'الاسم مطلوب', 400);

    const part = await db.sparePart.create({
        data: {
            partNumber,
            name: String(req.body.name),
            description: req.body.description || '',
            compatibleModels: req.body.compatibleModels || '',
            defaultCost: req.body.defaultCost ? parseFloat(req.body.defaultCost) : 0,
            isConsumable: req.body.isConsumable === 'true' || req.body.isConsumable === true,
            allowsMultiple: req.body.allowsMultiple === 'true' || req.body.allowsMultiple === true
        }
    });

    await logAction({
        entityType: 'SPARE_PART', entityId: part.id, action: 'CREATE',
        details: { name: part.name, cost: part.defaultCost },
        userId: req.user.id, performedBy: req.user.displayName, branchId: req.user.branchId
    });

    return success(res, part, 201);
}));

// PUT update spare part
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
    const currentPart = await db.sparePart.findUnique({ where: { id: req.params.id } });
    if (!currentPart) return error(res, 'القطعة غير موجودة', 404);

    if (req.body.defaultCost !== undefined && req.body.defaultCost !== currentPart.defaultCost) {
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

    await logAction({
        entityType: 'SPARE_PART', entityId: part.id, action: 'UPDATE',
        details: { name: part.name, changes: req.body },
        userId: req.user.id, performedBy: req.user.displayName, branchId: req.user.branchId
    });

    return success(res, part);
}));

// GET price change logs
router.get('/:id/price-logs', authenticateToken, asyncHandler(async (req, res) => {
    const logs = await db.priceChangeLog.findMany({
        where: { partId: req.params.id },
        orderBy: { changedAt: 'desc' }
    });
    return success(res, logs);
}));

// POST bulk delete
router.post('/bulk-delete', authenticateToken, asyncHandler(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return error(res, 'ids array required', 400);

    await db.priceChangeLog.deleteMany({ where: { partId: { in: ids } } });
    await db.stockMovement.deleteMany({ where: { partId: { in: ids }, branchId: { not: 'GLOBAL_DELETE' } } });
    await db.inventoryItem.deleteMany({ where: { partId: { in: ids }, branchId: { not: 'GLOBAL_DELETE' } } });
    
    const result = await db.sparePart.deleteMany({ where: { id: { in: ids } } });

    await logAction({
        entityType: 'SPARE_PART', entityId: 'BULK', action: 'BULK_DELETE',
        details: { count: result.count, ids },
        userId: req.user.id, performedBy: req.user.displayName, branchId: req.user.branchId
    });

    return success(res, { success: true, count: result.count });
}));

// POST import spare parts
router.post('/import', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return error(res, 'يرجى رفع ملف', 400);
    const results = await importSpareParts(req.file.buffer, req.user);
    return success(res, results);
}));

// GET Export Spare Parts to Excel
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
    const parts = await db.sparePart.findMany({
        include: { inventoryItems: true },
        orderBy: { partNumber: 'asc' }
    });

    const data = parts.map(p => ({
        partNumber: p.partNumber || '-',
        name: p.name || '-',
        description: p.description || '-',
        compatibleModels: p.compatibleModels || '-',
        defaultCost: p.defaultCost || 0,
        isConsumable: p.isConsumable ? 'نعم' : 'لا',
        allowsMultiple: p.allowsMultiple ? 'نعم' : 'لا',
        currentStock: p.inventoryItems?.reduce((sum, item) => sum + (item.quantity || 0), 0) || 0
    }));

    const columns = [
        { header: 'رقم القطعة', key: 'partNumber', width: 15 },
        { header: 'الاسم', key: 'name', width: 30 },
        { header: 'الوصف', key: 'description', width: 30 },
        { header: 'الموديلات المتوافقة', key: 'compatibleModels', width: 25 },
        { header: 'التكلفة الافتراضية', key: 'defaultCost', width: 15 },
        { header: 'قابلة للاستهلاك', key: 'isConsumable', width: 12 },
        { header: 'متعددة', key: 'allowsMultiple', width: 12 },
        { header: 'الكمية الحالية', key: 'currentStock', width: 15 }
    ];

    const buffer = await exportToExcel(data, columns, 'spare_parts_export');
    setExcelHeaders(res, generateExportFilename('spare_parts_export'));
    res.send(buffer);
}));

module.exports = router;
