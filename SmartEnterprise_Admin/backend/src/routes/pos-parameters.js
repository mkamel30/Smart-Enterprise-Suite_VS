const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

const syncQueueService = require('../services/syncQueue.service');

// Get all POS machine parameters
router.get('/', async (req, res) => {
    try {
        const parameters = await prisma.machineParameter.findMany({
            orderBy: { manufacturer: 'asc' }
        });
        res.json(parameters);
    } catch (error) {
        console.error('Failed to fetch POS parameters:', error);
        res.status(500).json({ error: 'Failed to fetch POS parameters' });
    }
});

// Broadcast all POS parameters to all branches
router.post('/broadcast', async (req, res) => {
    try {
        const parameters = await prisma.machineParameter.findMany();
        await syncQueueService.enqueueUpdate('MACHINE_PARAMETER', 'BROADCAST', parameters);
        res.json({ message: 'Machine Parameters broadcast initiated' });
    } catch (error) {
        console.error('Broadcast failed:', error);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// Create POS machine parameter
router.post('/', async (req, res) => {
    try {
        const { prefix, model, manufacturer } = req.body;
        
        if (!prefix || !model || !manufacturer) {
            return res.status(400).json({ error: 'Prefix, Model, and Manufacturer are required' });
        }

        const parameter = await prisma.machineParameter.create({
            data: { prefix, model, manufacturer }
        });

        res.status(201).json(parameter);
    } catch (error) {
        if (error.code === 'P2002') {
            return res.status(400).json({ error: 'Prefix already exists' });
        }
        console.error('Failed to create POS parameter:', error);
        res.status(500).json({ error: 'Failed to create POS parameter' });
    }
});

// Update POS machine parameter
router.put('/:id', async (req, res) => {
    try {
        const { prefix, model, manufacturer } = req.body;
        
        const parameter = await prisma.machineParameter.update({
            where: { id: req.params.id },
            data: { prefix, model, manufacturer }
        });
        
        res.json(parameter);
    } catch (error) {
        console.error('Failed to update POS parameter:', error);
        res.status(500).json({ error: 'Failed to update POS parameter' });
    }
});

// Delete POS machine parameter
router.delete('/:id', async (req, res) => {
    try {
        await prisma.machineParameter.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'POS parameter deleted successfully' });
    } catch (error) {
        console.error('Failed to delete POS parameter:', error);
        res.status(500).json({ error: 'Failed to delete POS parameter' });
    }
});

module.exports = router;
