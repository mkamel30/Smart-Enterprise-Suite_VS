const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
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
            const serialNumber = row.serialNumber || row['serialNumber'];
            const type = row.type || row['type'] || null;
            const customerId = row.customerId || row['customerId'] || null;

            // Validate
            if (!serialNumber) {
                errors.push({ row, error: 'serialNumber is required' });
                continue;
            }

            // Check if already exists in client sim cards (branch-scoped)
            const existingClient = await db.simCard.findFirst(ensureBranchWhere({
                where: {
                    serialNumber: serialNumber.toString()
                }
            }, req));

            if (existingClient) {
                skippedCount++;
                continue;
            }

            // Check if exists in warehouse (branch-scoped)
            const existingWarehouse = await db.warehouseSim.findFirst(ensureBranchWhere({
                where: {
                    serialNumber: serialNumber.toString()
                }
            }, req));

            if (existingWarehouse) {
                errors.push({ row, error: 'Serial exists in warehouse' });
                continue;
            }

            // Validate customer if provided (branch-scoped)
            if (customerId) {
                const customer = await db.customer.findFirst({
                    where: {
                        bkcode: customerId.toString(),
                        branchId
                    }
                });

                if (!customer) {
                    errors.push({ row, error: `Customer ${customerId} not found in branch` });
                    continue;
                }
            }

            try {
                await db.simCard.create({
                    data: {
                        serialNumber: serialNumber.toString(),
                        type: type ? type.toString() : null,
                        customerId: customerId ? customerId.toString() : null,
                        branchId
                    }
                });
                successCount++;
            } catch (err) {
                errors.push({ row, error: err.message });
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
            orderBy: { assignedAt: 'desc' }
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

        const updated = await db.simCard.update({
            where: { id },
            data: { type }
        });

        res.json(updated);
    } catch (error) {
        console.error('Failed to update SimCard:', error);
        res.status(500).json({ error: 'Failed to update SimCard' });
    }
});

module.exports = router;

