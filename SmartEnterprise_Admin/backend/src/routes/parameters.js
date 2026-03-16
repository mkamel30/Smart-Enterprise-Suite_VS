const express = require('express');
const router = express.Router();
const prisma = require('../db');

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

        res.json(parameter);
    } catch (error) {
        console.error('Failed to save parameter:', error);
        res.status(500).json({ error: 'Failed to save parameter' });
    }
});

module.exports = router;
