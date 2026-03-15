const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { ROLES } = require('../../../utils/constants');
const { generateTemplate, exportToExcel } = require('../../../utils/excel');
const asyncHandler = require('../../../utils/asyncHandler');
const { importSims } = require('../shared/importExport.service');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// GET template for ClientSimCard import
router.get('/simcards/template', authenticateToken, asyncHandler(async (req, res) => {
    const columns = [
        { header: 'serialNumber', key: 'serialNumber', width: 25 },
        { header: 'type', key: 'type', width: 15 },
        { header: 'networkType', key: 'networkType', width: 15 },
        { header: 'customerId', key: 'customerId', width: 15 }
    ];

    const buffer = await generateTemplate(columns, 'customer_sims_import.xlsx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customer_sims_import.xlsx');
    res.send(buffer);
}));

// POST import SimCards from Excel
router.post('/simcards/import', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return error(res, 'يرجى رفع ملف', 400);

    const branchId = req.user.branchId || req.body.branchId;
    if (!branchId) return error(res, 'معرف الفرع مطلوب للاستيراد', 400);

    const results = await importSims(req.file.buffer, branchId, req.user);
    return success(res, results);
}));

// GET export SimCards to Excel
router.get('/simcards/export', authenticateToken, asyncHandler(async (req, res) => {
    const simCards = await db.simCard.findMany({
        include: { customer: true },
        orderBy: { serialNumber: 'asc' }
    });

    const data = simCards.map(sim => ({
        serialNumber: sim.serialNumber,
        type: sim.type || '',
        networkType: sim.networkType || '',
        customerId: sim.customerId || '',
        customerName: sim.customer?.client_name || ''
    }));

    const columns = [
        { header: 'serialNumber', key: 'serialNumber', width: 25 },
        { header: 'type', key: 'type', width: 15 },
        { header: 'networkType', key: 'networkType', width: 15 },
        { header: 'customerId', key: 'customerId', width: 15 },
        { header: 'customerName', key: 'customerName', width: 30 }
    ];

    const buffer = await exportToExcel(data, columns, 'simcards-export.xlsx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=simcards-export.xlsx');
    res.send(buffer);
}));

// GET all SimCards with customer info - PAGINATED
router.get('/simcards', authenticateToken, asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;

    const [sims, total] = await Promise.all([
        db.simCard.findMany({
            include: {
                customer: {
                    select: { bkcode: true, client_name: true }
                }
            },
            take: limit,
            skip: offset,
            orderBy: { serialNumber: 'asc' }
        }),
        db.simCard.count({})
    ]);

    return paginated(res, sims, total, limit, offset);
}));

// GET SimCards for a specific customer
router.get('/customers/:customerId/simcards', authenticateToken, asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const simCards = await db.simCard.findMany({
        where: { customerId },
        orderBy: { serialNumber: 'desc' }
    });
    return success(res, simCards);
}));

// GET SIM movement history for a customer
router.get('/customers/:customerId/sim-history', authenticateToken, asyncHandler(async (req, res) => {
    const { customerId } = req.params;
    const history = await db.simMovementLog.findMany({
        where: { customerId },
        orderBy: { createdAt: 'desc' }
    });
    return success(res, history);
}));

// PUT update SimCard type
router.put('/simcards/:id', authenticateToken, asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { type, networkType } = req.body;

    const existing = await db.simCard.findFirst({ where: { id } });
    if (!existing) return error(res, 'الشريحة غير موجودة', 404);

    const updated = await db.simCard.update({
        where: { id },
        data: { type, networkType }
    });

    return success(res, updated);
}));

module.exports = router;
