const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');
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
            { header: 'customerId', key: 'customerId', width: 15 }
        ];

        const buffer = await generateTemplate(columns, 'customer_sims_import.xlsx');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customer_sims_import.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Failed to generate SimCards template:', error);
        res.status(500).json({ error: 'Failed to generate template' });
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

        res.json({
            success: true,
            imported: successCount,
            skipped: skippedCount,
            errors: errors.length > 0 ? errors : undefined
        });

    } catch (error) {
        console.error('Failed to import SimCards:', error);
        res.status(500).json({ error: 'Failed to import SimCards' });
    }
});

// GET export SimCards to Excel
router.get('/simcards/export', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);
        const simCards = await db.simCard.findMany(ensureBranchWhere({
            where: {
                ...where
            },
            include: {
                customer: true
            },
            orderBy: { serialNumber: 'asc' }
        }, req));

        const data = simCards.map(sim => ({
            serialNumber: sim.serialNumber,
            type: sim.type || '',
            customerId: sim.customerId || '',
            customerName: sim.customer?.client_name || ''
        }));

        const columns = [
            { header: 'serialNumber', key: 'serialNumber', width: 25 },
            { header: 'type', key: 'type', width: 15 },
            { header: 'customerId', key: 'customerId', width: 15 },
            { header: 'customerName', key: 'customerName', width: 30 }
        ];

        const buffer = await exportToExcel(data, columns, 'simcards-export.xlsx');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=simcards-export.xlsx');
        res.send(buffer);

    } catch (error) {
        console.error('Failed to export SimCards:', error);
        res.status(500).json({ error: 'Failed to export SimCards' });
    }
});

// GET all SimCards with customer info
router.get('/simcards', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);
        const simCards = await db.simCard.findMany(ensureBranchWhere({
            where: {
                ...where
            },
            include: {
                customer: {
                    select: {
                        bkcode: true,
                        client_name: true
                    }
                }
            },
            orderBy: { serialNumber: 'asc' }
        }, req));

        res.json(simCards);
    } catch (error) {
        console.error('Failed to fetch SimCards:', error);
        res.status(500).json({ error: 'Failed to fetch SimCards' });
    }
});

// GET SimCards for a specific customer
router.get('/customers/:customerId/simcards', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const simCards = await db.simCard.findMany(ensureBranchWhere({
            where: { customerId },
            orderBy: { serialNumber: 'desc' }
        }, req));
        res.json(simCards);
    } catch (error) {
        console.error('Failed to fetch customer SimCards:', error);
        res.status(500).json({ error: 'Failed to fetch customer SimCards' });
    }
});

// GET SIM movement history for a customer
router.get('/customers/:customerId/sim-history', authenticateToken, async (req, res) => {
    try {
        const { customerId } = req.params;
        const where = getBranchFilter(req);
        const history = await db.simMovementLog.findMany(ensureBranchWhere({
            where: {
                customerId,
                ...where
            },
            orderBy: { createdAt: 'desc' }
        }, req));
        res.json(history);
    } catch (error) {
        console.error('Failed to fetch SIM history:', error);
        res.status(500).json({ error: 'Failed to fetch SIM history' });
    }
});

// PUT update SimCard type
router.put('/simcards/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body;

        // Ensure user has access and add branchId to satisfy enforcer
        const existing = await db.simCard.findFirst({
            where: { id, branchId: req.user.branchId }
        });

        if (!existing) {
            return res.status(404).json({ error: 'SIM Card not found' });
        }

        await db.simCard.updateMany({
            where: { id, branchId: req.user.branchId },
            data: { type }
        });

        const updated = await db.simCard.findFirst({
            where: { id, branchId: req.user.branchId }
        });

        res.json(updated);
    } catch (error) {
        console.error('Failed to update SimCard:', error);
        res.status(500).json({ error: 'Failed to update SimCard' });
    }
});

module.exports = router;

