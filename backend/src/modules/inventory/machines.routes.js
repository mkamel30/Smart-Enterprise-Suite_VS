const express = require('express');
const router = express.Router();
const { z } = require('zod');
const multer = require('multer');
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { validateRequest } = require('../../../middleware/validation');
const { generateTemplate, exportToExcel } = require('../../../utils/excel');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { ROLES } = require('../../../utils/constants');
const { logAction } = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');
const { importMachines } = require('../shared/importExport.service');

const upload = multer({ storage: multer.memoryStorage() });

// Validation Schemas
const applyParametersSchema = z.object({
    dryRun: z.boolean().optional().default(false)
});

// GET template for Machine import
router.get('/machines/template', authenticateToken, asyncHandler(async (req, res) => {
    const columns = [
        { header: 'serialNumber', key: 'serialNumber', width: 25 },
        { header: 'customerId', key: 'customerId', width: 15 },
        { header: 'posId', key: 'posId', width: 15 }
    ];

    const buffer = await generateTemplate(columns, 'customer_machines_import.xlsx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=customer_machines_import.xlsx');
    res.send(buffer);
}));

// POST import Machines from Excel
router.post('/machines/import', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return error(res, 'يرجى رفع ملف', 400);

    const branchId = req.user.branchId || req.body.branchId;
    if (!branchId) return error(res, 'معرف الفرع مطلوب', 400);

    const results = await importMachines(req.file.buffer, branchId, req.user);
    return success(res, results);
}));

// GET export Machines to Excel
router.get('/machines/export', authenticateToken, asyncHandler(async (req, res) => {
    const machines = await db.posMachine.findMany({
        include: { customer: true },
        orderBy: { serialNumber: 'asc' }
    });

    const data = machines.map(machine => ({
        serialNumber: machine.serialNumber,
        model: machine.model || '',
        manufacturer: machine.manufacturer || '',
        customerId: machine.customerId || '',
        customerName: machine.customer?.client_name || '',
        posId: machine.posId || ''
    }));

    const columns = [
        { header: 'serialNumber', key: 'serialNumber', width: 25 },
        { header: 'model', key: 'model', width: 20 },
        { header: 'manufacturer', key: 'manufacturer', width: 20 },
        { header: 'customerId', key: 'customerId', width: 15 },
        { header: 'customerName', key: 'customerName', width: 30 },
        { header: 'posId', key: 'posId', width: 15 }
    ];

    const buffer = await exportToExcel(data, columns, 'machines-export.xlsx');

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=machines-export.xlsx');
    res.send(buffer);
}));

// GET all Machines with customer info - PAGINATED
router.get('/machines', authenticateToken, asyncHandler(async (req, res) => {
    const limit = parseInt(req.query.limit) || 50;
    const offset = parseInt(req.query.offset) || 0;
    const [machines, total] = await Promise.all([
        db.posMachine.findMany({
            include: {
                customer: {
                    select: {
                        bkcode: true,
                        client_name: true
                    }
                }
            },
            take: limit,
            skip: offset,
            orderBy: { serialNumber: 'asc' }
        }),
        db.posMachine.count({})
    ]);

    return paginated(res, machines, total, limit, offset);
}));

// POST apply parameters to machines missing model/manufacturer
router.post('/machines/apply-parameters', authenticateToken, validateRequest(applyParametersSchema), asyncHandler(async (req, res) => {
    const machineParams = await db.machineParameter.findMany();
    const machinesToUpdate = await db.posMachine.findMany({
        where: {
            OR: [
                { model: null }, { manufacturer: null },
                { model: '' }, { manufacturer: '' }
            ]
        }
    });

    let updatedCount = 0;
    await db.$transaction(async (tx) => {
        for (const machine of machinesToUpdate) {
            const matchingParam = machineParams.find(param =>
                machine.serialNumber.startsWith(param.prefix)
            );

            if (matchingParam) {
                await tx.posMachine.updateMany({
                    where: { id: machine.id, branchId: machine.branchId },
                    data: {
                        model: matchingParam.model,
                        manufacturer: matchingParam.manufacturer
                    }
                });
                updatedCount++;
            }
        }
    });

    return success(res, {
        checked: machinesToUpdate.length,
        updated: updatedCount
    });
}));

module.exports = router;
