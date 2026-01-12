const express = require('express');
const router = express.Router();
const db = require('../db');

// GET spare parts (mounted at /api/spare-parts, so path is just '/')
router.get('/', async (req, res) => {
    try {
        const parts = await db.sparePart.findMany({
            include: {
                inventoryItems: true
            }
        });
        res.json(parts);
    } catch (error) {
        console.error('Failed to fetch spare parts:', error);
        res.status(500).json({ error: 'Failed to fetch spare parts' });
    }
});

// POST create spare part (with auto-generated part number)
router.post('/', async (req, res) => {
    try {
        // Get count for auto-generated part number
        const count = await db.sparePart.count();
        const partNumber = `SP${String(count + 1).padStart(4, '0')}`; // SP0001, SP0002, etc.
        if (!req.body || !req.body.name) return res.status(400).json({ error: 'name is required' });

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
            userId: req.body.userId,
            performedBy: req.body.userName, // Expect frontend to send this
            branchId: req.body.branchId
        });

        res.status(201).json(part);
    } catch (error) {
        console.error('Failed to create spare part:', error);
        res.status(500).json({ error: 'Failed to create spare part' });
    }
});

// PUT update spare part (with price logging)
router.put('/:id', async (req, res) => {
    try {
        // Get current part to check price change
        const currentPart = await db.sparePart.findUnique({
            where: { id: req.params.id }
        });

        if (!currentPart) {
            return res.status(404).json({ error: 'Part not found' });
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
                    userId: req.body.userId || null
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
            userId: req.body.userId,
            performedBy: req.body.userName,
            branchId: req.body.branchId
        });

        res.json(part);
    } catch (error) {
        console.error('Failed to update spare part:', error);
        res.status(500).json({ error: 'Failed to update spare part' });
    }
});

// GET price change logs for a part
router.get('/:id/price-logs', async (req, res) => {
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
});

const { logAction } = require('../utils/logger');

// POST bulk delete spare parts
router.post('/bulk-delete', async (req, res) => {
    try {
        const { ids, userId, userName, branchId } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: 'ids array required' });
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
            userId,
            performedBy: userName,
            branchId
        });

        res.json({ success: true, count: result.count });
    } catch (error) {
        console.error('Failed to bulk delete parts:', error);
        res.status(500).json({ error: 'Failed to delete parts' });
    }
});

// POST import spare parts (with duplicate check)
router.post('/import', async (req, res) => {
    try {
        const { parts, userId, userName, branchId } = req.body;
        if (!Array.isArray(parts)) return res.status(400).json({ error: 'parts array required' });

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
                userId,
                performedBy: userName,
                branchId
            });
        }

        res.status(201).json(results);
    } catch (error) {
        console.error('Failed to import spare parts:', error);
        res.status(500).json({ error: 'Failed to import spare parts' });
    }
});

/**
 * GET Export Spare Parts to Excel
 */
const { exportToExcel } = require('../utils/excel');
router.get('/export', async (req, res) => {
    try {
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
    } catch (error) {
        console.error('Failed to export spare parts:', error);
        res.status(500).json({ error: 'فشل في تصدير قطع الغيار' });
    }
});

module.exports = router;

