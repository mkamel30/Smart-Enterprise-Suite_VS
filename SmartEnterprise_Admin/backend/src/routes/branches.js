const express = require('express');
const router = express.Router();
const prisma = require('../db');
const crypto = require('crypto');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

// Get all branches
router.get('/', async (req, res) => {
    try {
        const branches = await prisma.branch.findMany({
            orderBy: { name: 'asc' },
            include: {
                _count: {
                    select: { backups: true }
                }
            }
        });
        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch branches:', error);
        res.status(500).json({ error: 'Failed to fetch branches' });
    }
});

// Register new branch
router.post('/', async (req, res) => {
    try {
        const { code, name, address, authorizedHWID } = req.body;
        
        if (!code || !name) {
            return res.status(400).json({ error: 'Code and Name are required' });
        }

        const existing = await prisma.branch.findUnique({ where: { code } });
        if (existing) {
            return res.status(400).json({ error: 'Branch code already exists' });
        }

        // Generate a unique API Key for the branch
        const apiKey = crypto.randomBytes(32).toString('hex');

        const branch = await prisma.branch.create({
            data: {
                code,
                name,
                address,
                apiKey,
                authorizedHWID
            }
        });

        res.status(201).json(branch);
    } catch (error) {
        console.error('Failed to register branch:', error);
        res.status(500).json({ error: 'Failed to register branch' });
    }
});

// Update branch
router.put('/:id', async (req, res) => {
    try {
        const { name, code, address, authorizedHWID, status } = req.body;
        
        const branch = await prisma.branch.update({
            where: { id: req.params.id },
            data: {
                name,
                code,
                address,
                authorizedHWID,
                status
            }
        });
        
        res.json(branch);
    } catch (error) {
        console.error('Failed to update branch:', error);
        res.status(500).json({ error: 'Failed to update branch' });
    }
});

// Delete branch
router.delete('/:id', async (req, res) => {
    try {
        await prisma.branch.delete({
            where: { id: req.params.id }
        });
        res.json({ message: 'Branch deleted successfully' });
    } catch (error) {
        console.error('Failed to delete branch:', error);
        res.status(500).json({ error: 'Failed to delete branch' });
    }
});

// Get branch details
router.get('/:id', async (req, res) => {
    try {
        const branch = await prisma.branch.findUnique({
            where: { id: req.params.id },
            include: {
                backups: {
                    take: 5,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        
        if (!branch) {
            return res.status(404).json({ error: 'Branch not found' });
        }
        
        res.json(branch);
    } catch (error) {
        console.error('Failed to fetch branch:', error);
        res.status(500).json({ error: 'Failed to fetch branch' });
    }
});

module.exports = router;
