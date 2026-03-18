const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

// Get all customers (Global View)
router.get('/', async (req, res) => {
    try {
        const customers = await prisma.customer.findMany({
            include: { branch: true, machines: true },
            orderBy: { client_name: 'asc' }
        });
        res.json(customers);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch customers' });
    }
});

// Create Customer
router.post('/', async (req, res) => {
    try {
        const customer = await prisma.customer.create({
            data: req.body
        });
        res.status(201).json(customer);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create customer' });
    }
});

module.exports = router;
