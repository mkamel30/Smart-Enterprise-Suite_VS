const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const bcrypt = require('bcryptjs');

const { logAction } = require('../utils/logger');

// GET all users (Admin only sees all, others might need filtering but this is internal API)
// TODO: Protect with middleware later
router.get('/technicians', authenticateToken, async (req, res) => {
    try {
        const { branchId } = req.query;
        // Filter for users who can do maintenance
        // If user is restricted to a branch, force that branch
        const where = {
            canDoMaintenance: true
        };

        if (branchId) {
            where.branchId = branchId;
        } else if (req.user.branchId) {
            where.branchId = req.user.branchId;
        }

        const technicians = await db.user.findMany({
            where,
            select: {
                id: true,
                displayName: true,
                email: true,
                role: true,
                branchId: true
            },
            orderBy: { displayName: 'asc' }
        });

        res.json(technicians);
    } catch (error) {
        console.error('Failed to fetch technicians:', error);
        res.status(500).json({ error: 'Failed to fetch technicians' });
    }
});

router.get('/users', authenticateToken, async (req, res) => {
    try {
        const { branchId } = req.query;
        const where = branchId ? { branchId } : {};

        const users = await db.user.findMany({
            where,
            orderBy: { displayName: 'asc' },
            include: { branch: true }
        });
        res.json(users);
    } catch (error) {
        console.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// GET users by branch (Public or protected? Public for login)
router.get('/users/by-branch/:branchId', authenticateToken, async (req, res) => {
    try {
        const users = await db.user.findMany({
            where: {
                branchId: req.params.branchId,
                role: { not: 'Admin' } // Don't show admins in branch login? Or maybe yes? User said Admin enters without branch.
            },
            orderBy: { displayName: 'asc' },
            select: { id: true, displayName: true, role: true } // Only return necessary info
        });
        res.json(users);
    } catch (error) {
        console.error('Failed to fetch branch users:', error);
        res.status(500).json({ error: 'Failed to fetch users' });
    }
});

// POST create user
router.post('/users', authenticateToken, async (req, res) => {
    try {
        const user = await db.user.create({
            data: {
                displayName: req.body.displayName,
                role: req.body.role,
                email: req.body.email || null,
                canDoMaintenance: req.body.canDoMaintenance || false,
                branchId: req.body.branchId || null // Add branchId
            }
        });

        await logAction({
            entityType: 'USER',
            entityId: user.id,
            action: 'CREATE',
            details: `Created user ${user.displayName} with role ${user.role} in branch ${req.body.branchId || 'Global'}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'Admin',
            branchId: user.branchId
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Failed to create user:', error);
        res.status(500).json({ error: 'Failed to create user' });
    }
});

// PUT update user
router.put('/users/:id', authenticateToken, async (req, res) => {
    try {
        const existingUser = await db.user.findUnique({ where: { id: req.params.id } });

        const user = await db.user.update({
            where: { id: req.params.id },
            data: {
                displayName: req.body.displayName,
                role: req.body.role,
                email: req.body.email,
                canDoMaintenance: req.body.canDoMaintenance,
                branchId: req.body.branchId // Update branchId
            }
        });

        // Log Role Change
        if (existingUser.role !== req.body.role) {
            await logAction({
                entityType: 'USER',
                entityId: user.id,
                action: 'ROLE_CHANGE',
                details: `Changed role from ${existingUser.role} to ${user.role}`,
                userId: req.user?.id,
                performedBy: req.user?.displayName || 'Admin',
                branchId: user.branchId
            });
        }

        // Log Update details
        await logAction({
            entityType: 'USER',
            entityId: user.id,
            action: 'UPDATE',
            details: JSON.stringify({
                old: { displayName: existingUser.displayName, email: existingUser.email },
                new: { displayName: user.displayName, email: user.email }
            }),
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'Admin',
            branchId: user.branchId
        });

        res.json(user);
    } catch (error) {
        console.error('Failed to update user:', error);
        res.status(500).json({ error: 'Failed to update user' });
    }
});

// DELETE user
router.delete('/users/:id', authenticateToken, async (req, res) => {
    try {
        const user = await db.user.findUnique({ where: { id: req.params.id } });
        await db.user.delete({ where: { id: req.params.id } });

        if (user) {
            await logAction({
                entityType: 'USER',
                entityId: user.id,
                action: 'DELETE',
                details: `Deleted user ${user.displayName} (${user.role})`,
                userId: req.user?.id,
                performedBy: req.user?.displayName || 'Admin',
                branchId: user.branchId
            });
        }

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete user:', error);
        res.status(500).json({ error: 'Failed to delete user' });
    }
});

// POST import users
router.post('/users/import', authenticateToken, async (req, res) => {
    try {
        const { users } = req.body;
        let count = 0;

        for (const u of users) {
            const existing = u.email
                ? await db.user.findFirst({ where: { email: u.email } })
                : await db.user.findFirst({ where: { displayName: u.displayName } });

            if (existing) continue;

            const newUser = await db.user.create({
                data: {
                    displayName: u.displayName,
                    email: u.email || null,
                    role: u.role || 'Technician',
                    password: u.password || '123456'
                }
            });
            count++;

            await logAction({
                entityType: 'USER',
                entityId: newUser.id,
                action: 'IMPORT',
                details: `Imported via CSV`,
                userId: req.user?.id,
                performedBy: req.user?.displayName || 'System'
            });
        }

        res.json({ success: true, count });
    } catch (error) {
        console.error('Failed to import users:', error);
        res.status(500).json({ error: 'Failed to import users' });
    }
});

// POST reset user password
router.post('/users/:id/reset-password', authenticateToken, async (req, res) => {
    try {
        const { newPassword } = req.body;
        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'Password must be at least 6 characters' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        const user = await db.user.findUnique({ where: { id: req.params.id } });

        await db.user.update({
            where: { id: req.params.id },
            data: { password: hashedPassword }
        });

        if (user) {
            await logAction({
                entityType: 'USER',
                entityId: user.id,
                action: 'PASSWORD_RESET',
                details: `Password reset by admin`,
                userId: req.user?.id,
                performedBy: req.user?.displayName || 'Admin',
                branchId: user.branchId
            });
        }

        res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    } catch (error) {
        console.error('Failed to reset password:', error);
        res.status(500).json({ error: 'Failed to reset password' });
    }
});

module.exports = router;
