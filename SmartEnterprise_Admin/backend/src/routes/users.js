const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');
const bcrypt = require('bcryptjs');

router.use(adminAuth);

// Get all users across all branches
router.get('/', async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            include: { branch: true },
            orderBy: { createdAt: 'desc' }
        });
        res.json(users);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// Create user
router.post('/', async (req, res) => {
    try {
        const { username, password, displayName, role, branchId, email } = req.body;
        
        const passwordHash = await bcrypt.hash(password, 10);
        
        const user = await prisma.user.create({
            data: {
                username,
                email,
                password: passwordHash,
                displayName,
                role,
                branchId
            }
        });
        
        res.status(201).json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// Update user
router.put('/:id', async (req, res) => {
    try {
        const { displayName, role, branchId, email, isActive } = req.body;
        
        const user = await prisma.user.update({
            where: { id: req.params.id },
            data: { displayName, role, branchId, email, isActive }
        });
        
        res.json(user);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// Delete user
router.delete('/:id', async (req, res) => {
    try {
        await prisma.user.delete({ where: { id: req.params.id } });
        res.json({ message: 'User deleted' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

module.exports = router;
