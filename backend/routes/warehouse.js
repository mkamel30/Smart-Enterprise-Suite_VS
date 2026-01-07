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

// POST bulk import spare parts
router.post('/import', async (req, res) => {
    try {
        const parts = req.body.parts;
        if (!Array.isArray(parts)) return res.status(400).json({ error: 'parts array required' });
        const created = [];
        for (const part of parts) {
            const newPart = await db.sparePart.create({
                data: {
                    partNumber: part.partNumber,
                    name: part.name,
                    description: part.description || '',
                    compatibleModels: part.compatibleModels || '',
                    defaultCost: parseFloat(part.defaultCost) || 0,
                    isConsumable: part.isConsumable === 'true' || part.isConsumable === true,
                    allowsMultiple: part.allowsMultiple === 'true' || part.allowsMultiple === true
                }
            });
            created.push(newPart);
        }
        res.status(201).json({ created: created.length, parts: created });
    } catch (error) {
        console.error('Failed to import spare parts:', error);
        res.status(500).json({ error: 'Failed to import spare parts' });
    }
});

// DELETE spare part
router.delete('/:id', async (req, res) => {
    try {
        // First, delete all related inventory items
        await db.inventoryItem.deleteMany({
            where: { partId: req.params.id }
        });

        // Then delete the spare part
        await db.sparePart.delete({ where: { id: req.params.id } });
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete spare part:', error);
        if (error?.code === 'P2025') return res.status(404).json({ error: 'SparePart not found' });
        res.status(500).json({ error: 'Failed to delete spare part' });
    }
});

module.exports = router;

