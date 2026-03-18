const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

const syncQueueService = require('../services/syncQueue.service');

// Get all Master Spare Parts
router.get('/', async (req, res) => {
    try {
        const parts = await prisma.masterSparePart.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(parts);
    } catch (error) {
        console.error('Failed to fetch master spare parts:', error);
        res.status(500).json({ error: 'Failed to fetch master spare parts' });
    }
});

// Broadcast master spare parts to all branches
router.post('/broadcast', async (req, res) => {
    try {
        const masterParts = await prisma.masterSparePart.findMany();
        await syncQueueService.enqueueUpdate('SPARE_PART', 'BROADCAST', masterParts);
        res.json({ message: 'Spare parts broadcast initiated' });
    } catch (error) {
        console.error('Broadcast failed:', error);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// Create Master Spare Part
router.post('/', async (req, res) => {
    try {
        const { partNumber, name, description, compatibleModels, defaultCost, isConsumable, category } = req.body;
        
        if (!name) {
            return res.status(400).json({ error: 'Part Name is required' });
        }

        const part = await prisma.masterSparePart.create({
            data: { 
                partNumber, 
                name, 
                description, 
                compatibleModels, 
                defaultCost: parseFloat(defaultCost) || 0, 
                isConsumable: !!isConsumable, 
                category 
            }
        });

        res.status(201).json(part);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Part Number already exists' });
        }
        console.error('Failed to create master spare part:', error);
        res.status(500).json({ error: 'Failed to create master spare part' });
    }
});

// Update Master Spare Part
router.put('/:id', async (req, res) => {
    try {
        const { partNumber, name, description, compatibleModels, defaultCost, isConsumable, category } = req.body;
        
        const part = await prisma.masterSparePart.update({
            where: { id: req.params.id },
            data: { 
                partNumber, 
                name, 
                description, 
                compatibleModels, 
                defaultCost: parseFloat(defaultCost), 
                isConsumable: !!isConsumable, 
                category 
            }
        });
        
        res.json(part);
    } catch (error) {
        console.error('Failed to update master spare part:', error);
        res.status(500).json({ error: 'Failed to update master spare part' });
    }
});

// Delete Master Spare Part
router.delete('/:id', async (req, res) => {
    try {
        await prisma.masterSparePart.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Master spare part deleted successfully' });
    } catch (error) {
        console.error('Failed to delete master spare part:', error);
        res.status(500).json({ error: 'Failed to delete master spare part' });
    }
});

module.exports = router;
