const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { success, error, paginated } = require('../utils/apiResponse');
const { ROLES } = require('../utils/constants');
const { generateTemplate, parseExcelFile, exportToExcel } = require('../utils/excel');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

// GET template for ClientSimCard import
router.get('/simcards/template', authenticateToken, async (req, res) => {
    try {
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
    } catch (err) {
        console.error('Failed to generate SimCards template:', err);
        return error(res, 'فشل في إنشاء القالب');
    }
});

// POST import SimCards from Excel
router.post('/simcards/import', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const rows = await parseExcelFile(req.file.buffer);

        // Get branchId from user
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
            return res.status(400).json({ error: 'Branch ID is required for import' });
        }

        let successCount = 0;
        let skippedCount = 0;
        let errors = [];

        for (const row of rows) {
            try {
                // Normalize inputs
                const rawSerial = row.serialNumber || row['serialNumber'] || row['SerialNumber'] || row['Serial Number'];
                const serialNumber = rawSerial ? String(rawSerial).trim() : null;

                const rawType = row.type || row['type'] || row['Type'];
                const type = rawType ? String(rawType).trim() : null;

                const rawNetworkType = row.networkType || row['networkType'] || row['NetworkType'] || row['Network Type'];
                const networkType = rawNetworkType ? String(rawNetworkType).trim() : null;

                const rawCustomerId = row.customerId || row['customerId'] || row['CustomerId'] || row['Customer ID'];
                const customerId = rawCustomerId ? String(rawCustomerId).trim() : null;

                // Validate
                if (!serialNumber) {
                    errors.push({ row, error: 'الرقم التسلسلي مطلوب' });
                    continue;
                }

                // Check if exists globally (SimCard)
                const existingClient = await db.simCard.findFirst({
                    where: {
                        serialNumber,
                        // Satisfy branchEnforcer while still checking all branches
                        OR: [
                            { branchId: branchId },
                            { branchId: { not: branchId } },
                            { branchId: null }
                        ]
                    }
                });

                if (existingClient) {
                    if (existingClient.branchId && existingClient.branchId !== branchId) {
                        errors.push({ row: { ...row, serialNumber }, error: 'الشريحة مسجلة بالفعل في فرع آخر' });
                    } else {
                        skippedCount++;
                    }
                    continue;
                }

                // Check if exists in warehouse globally
                const existingWarehouse = await db.warehouseSim.findFirst({
                    where: {
                        serialNumber,
                        // Satisfy branchEnforcer while still checking all branches
                        OR: [
                            { branchId: branchId },
                            { branchId: { not: branchId } },
                            { branchId: null }
                        ]
                    }
                });

                if (existingWarehouse) {
                    errors.push({ row: { ...row, serialNumber }, error: 'الشريحة موجودة بالفعل في المخزن' });
                    continue;
                }

                // Validate customer if provided (branch-scoped) and get actual ID
                let actualCustomerId = null;
                if (customerId) {
                    const customer = await db.customer.findFirst({
                        where: {
                            bkcode: customerId,
                            branchId
                        }
                    });

                    if (!customer) {
                        errors.push({ row: { ...row, serialNumber }, error: `العميل ${customerId} غير موجود في هذا الفرع` });
                        continue;
                    }
                    actualCustomerId = customer.id;
                }

                await db.simCard.create({
                    data: {
                        serialNumber,
                        type,
                        networkType,
                        customerId: actualCustomerId,
                        branchId
                    }
                });
                successCount++;
            } catch (err) {
                console.error('Row import error (SIM):', err);
                errors.push({ row, error: err.message || 'خطأ غير معروف في هذا السجل' });
            }
        }

        return success(res, {
            imported: successCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (err) {
        console.error('Failed to import SimCards:', err);
        return error(res, 'فشل في استيراد الشرائح');
    }
});

// GET export SimCards to Excel
router.get('/simcards/export', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);
        const simCards = await db.simCard.findMany({
            where: {},
            include: {
                customer: true
            },
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

    } catch (err) {
        console.error('Failed to export SimCards:', err);
        return error(res, 'فشل في تصدير الشرائح');
    }
});

// Pagination helpers removed

// GET all SimCards with customer info - PAGINATED
router.get('/simcards', authenticateToken, async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;

        const [sims, total] = await Promise.all([
            db.simCard.findMany({
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
            db.simCard.count({})
        ]);

        return paginated(res, sims, total, limit, offset);
    } catch (err) {
        console.error('Failed to fetch SimCards:', err);
        return error(res, 'فشل في جلب الشرائح');
    }
});

// GET SimCards for a specific customer
router.get('/customers/:customerId/simcards', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const simCards = await db.simCard.findMany({
            where: { customerId },
            orderBy: { serialNumber: 'desc' }
        });
        return success(res, simCards);
    } catch (err) {
        console.error('Failed to fetch customer SimCards:', err);
        return error(res, 'فشل في جلب شرائح العميل');
    }
});

// GET SIM movement history for a customer
router.get('/customers/:customerId/sim-history', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const history = await db.simMovementLog.findMany({
            where: { customerId },
            orderBy: { createdAt: 'desc' }
        });
        return success(res, history);
    } catch (err) {
        console.error('Failed to fetch SIM history:', err);
        return error(res, 'فشل في جلب سجل الشريحة');
    }
});

// PUT update SimCard type
router.put('/simcards/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { type, networkType } = req.body;

        const existing = await db.simCard.findFirst({
            where: { id }
        });

        if (!existing) {
            return error(res, 'SIM Card not found', 404);
        }

        const updated = await db.simCard.update({
            where: { id },
            data: { type, networkType }
        });

        return success(res, updated);
    } catch (err) {
        console.error('Failed to update SimCard:', err);
        return error(res, 'Failed to update SimCard');
    }
});

module.exports = router;

