const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

// Get Global Warehouse Inventory (New & Standby)
router.get('/machines', async (req, res) => {
    try {
        const machines = await prisma.warehouseMachine.findMany({
            include: { branch: true },
            orderBy: { serialNumber: 'asc' }
        });
        res.json(machines);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch warehouse machines' });
    }
});

// Get Active Fleet (At Customers)
router.get('/fleet', async (req, res) => {
    try {
        const fleet = await prisma.posMachine.findMany({
            include: { branch: true, customer: true },
            orderBy: { serialNumber: 'asc' }
        });
        res.json(fleet);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch fleet' });
    }
});

module.exports = router;
