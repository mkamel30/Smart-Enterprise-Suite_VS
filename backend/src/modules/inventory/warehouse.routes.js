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

// POST create spare part - BLOCKED: spare parts are managed by admin portal only
router.post('/', authenticateToken, asyncHandler(async (req, res) => {
    return error(res, 'القطع الغيار تُدار من لوحة الإدارة المركزية فقط', 403);
}));

// PUT update spare part - BLOCKED: spare parts are managed by admin portal only
router.put('/:id', authenticateToken, asyncHandler(async (req, res) => {
    return error(res, 'القطع الغيار تُدار من لوحة الإدارة المركزية فقط', 403);
}));

// GET price change logs
router.get('/:id/price-logs', authenticateToken, asyncHandler(async (req, res) => {
    const logs = await db.sparePartPriceLog.findMany({
        where: { partId: req.params.id },
        orderBy: { changedAt: 'desc' }
    });
    return success(res, logs);
}));

// POST bulk delete - BLOCKED: spare parts are managed by admin portal only
router.post('/bulk-delete', authenticateToken, asyncHandler(async (req, res) => {
    return error(res, 'القطع الغيار تُدار من لوحة الإدارة المركزية فقط', 403);
}));

// POST import spare parts - BLOCKED: spare parts are managed by admin portal only
router.post('/import', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
    return error(res, 'القطع الغيار تُدار من لوحة الإدارة المركزية فقط', 403);
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
