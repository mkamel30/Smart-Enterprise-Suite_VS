const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

const syncQueueService = require('../services/syncQueue.service');

// Get all parameters
router.get('/', async (req, res) => {
    try {
        const parameters = await prisma.globalParameter.findMany({
            orderBy: { key: 'asc' }
        });
        res.json(parameters);
    } catch (error) {
        console.error('Failed to fetch parameters:', error);
        res.status(500).json({ error: 'Failed to fetch parameters' });
    }
});

// Broadcast all parameters to all branches
router.post('/broadcast', async (req, res) => {
    try {
        const parameters = await prisma.globalParameter.findMany();
        await syncQueueService.enqueueUpdate('GLOBAL_PARAMETER', 'BROADCAST', parameters);
        res.json({ message: 'Broadcast initiated' });
    } catch (error) {
        console.error('Broadcast failed:', error);
        res.status(500).json({ error: 'Broadcast failed' });
    }
});

// Update or create parameter
router.post('/', async (req, res) => {
    try {
        const { key, value, type, group } = req.body;
        
        if (!key || value === undefined) {
            return res.status(400).json({ error: 'Key and Value are required' });
        }

        const parameter = await prisma.globalParameter.upsert({
            where: { key },
            update: { value: String(value), type, group },
            create: { key, value: String(value), type, group }
        });

        // Trigger broadcast to branches via syncQueue
        await syncQueueService.enqueueUpdate('GLOBAL_PARAMETER', 'UPSERT', parameter);

        res.json(parameter);
    } catch (error) {
        console.error('Failed to save parameter:', error);
        res.status(500).json({ error: 'Failed to save parameter' });
    }
});

// Update parameter by ID
router.put('/:id', async (req, res) => {
    try {
        const { value, type, group, key } = req.body;
        
        const parameter = await prisma.globalParameter.update({
            where: { id: req.params.id },
            data: { 
                value: value !== undefined ? String(value) : undefined,
                type,
                group,
                key
            }
        });
        
        // Trigger broadcast to branches via syncQueue
        await syncQueueService.enqueueUpdate('GLOBAL_PARAMETER', 'UPDATE', parameter);

        res.json(parameter);
    } catch (error) {
        console.error('Failed to update parameter:', error);
        res.status(500).json({ error: 'Failed to update parameter' });
    }
});

// Delete parameter
router.delete('/:id', async (req, res) => {
    try {
        await prisma.globalParameter.delete({
            where: { id: req.params.id }
        });

        // Trigger broadcast to branches via syncQueue
        await syncQueueService.enqueueUpdate('GLOBAL_PARAMETER', 'DELETE', { id: req.params.id });

        res.json({ message: 'Parameter deleted successfully' });
    } catch (error) {
        console.error('Failed to delete parameter:', error);
        res.status(500).json({ error: 'Failed to delete parameter' });
    }
});

module.exports = router;
