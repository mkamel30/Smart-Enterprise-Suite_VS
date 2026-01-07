/**
 * Users Route
 * 
 * Provides user management endpoints.
 */

const express = require('express');
const router = express.Router();
const db = require('../db');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { logAction } = require('../utils/logger');

// GET all users (admin only)
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { branchId, role, isActive } = req.query;

        const where = {};

        // Branch filtering based on user role
        if (req.user.role === 'SUPER_ADMIN') {
            // Can see all users, optionally filter by branch
            if (branchId) where.branchId = branchId;
            else where.branchId = { not: null }; // Comply with branch enforcer
        } else {
            // Non-super admins can only see users in their branch
            where.branchId = req.user.branchId;
        }

        // Additional filters
        if (role) where.role = role;
        if (isActive !== undefined) where.isActive = isActive === 'true';

        const users = await db.user.findMany({
            where,
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                branchId: true,
                canDoMaintenance: true,
                createdAt: true,
                branch: {
                    select: { id: true, name: true, code: true }
                }
            },
            orderBy: { displayName: 'asc' }
        });

        res.json(users);
    } catch (error) {
        console.error('Failed to fetch users:', error);
        res.status(500).json({ error: 'فشل في جلب المستخدمين' });
    }
});

// GET single user
router.get('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const user = await db.user.findFirst({
            where: {
                id: req.params.id,
                branchId: req.user.role === 'SUPER_ADMIN' ? { not: null } : req.user.branchId
            },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                branchId: true,
                canDoMaintenance: true,
                theme: true,
                fontFamily: true,
                createdAt: true,
                branch: {
                    select: { id: true, name: true, code: true }
                }
            }
        });

        if (!user) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        res.json(user);
    } catch (error) {
        console.error('Failed to fetch user:', error);
        res.status(500).json({ error: 'فشل في جلب المستخدم' });
    }
});

// POST create user (super admin only)
router.post('/', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { email, displayName, password, role, branchId, canDoMaintenance } = req.body;

        if (!email || !displayName || !branchId) {
            return res.status(400).json({ error: 'البريد الإلكتروني والاسم والفرع مطلوبين' });
        }

        // Check for duplicate email
        const existing = await db.user.findFirst({
            where: { email, branchId: { not: null } }
        });

        if (existing) {
            return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }

        // Hash password
        const hashedPassword = password ? await bcrypt.hash(password, 10) : await bcrypt.hash('123456', 10);

        const user = await db.user.create({
            data: {
                email,
                displayName,
                password: hashedPassword,
                role: role || 'CS_AGENT',
                branchId,
                canDoMaintenance: canDoMaintenance || false
            },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                branchId: true,
                canDoMaintenance: true,
                createdAt: true
            }
        });

        await logAction({
            entityType: 'USER',
            entityId: user.id,
            action: 'CREATE',
            details: `Created user: ${user.displayName}`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: branchId
        });

        res.status(201).json(user);
    } catch (error) {
        console.error('Failed to create user:', error);
        res.status(500).json({ error: error.message || 'فشل في إنشاء المستخدم' });
    }
});

// PUT update user (super admin only)
router.put('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { displayName, role, branchId, canDoMaintenance, password } = req.body;

        const existing = await db.user.findFirst({
            where: { id: req.params.id, branchId: { not: null } }
        });

        if (!existing) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        const updateData = {};
        if (displayName) updateData.displayName = displayName;
        if (role) updateData.role = role;
        if (branchId) updateData.branchId = branchId;
        if (canDoMaintenance !== undefined) updateData.canDoMaintenance = canDoMaintenance;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        await db.user.updateMany({
            where: { id: req.params.id, branchId: { not: null } },
            data: updateData
        });

        const updated = await db.user.findFirst({
            where: { id: req.params.id, branchId: { not: null } },
            select: {
                id: true,
                email: true,
                displayName: true,
                role: true,
                branchId: true,
                canDoMaintenance: true,
                createdAt: true
            }
        });

        await logAction({
            entityType: 'USER',
            entityId: req.params.id,
            action: 'UPDATE',
            details: `Updated user: ${updated?.displayName}`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: updated?.branchId
        });

        res.json(updated);
    } catch (error) {
        console.error('Failed to update user:', error);
        res.status(500).json({ error: error.message || 'فشل في تحديث المستخدم' });
    }
});

// DELETE user (super admin only)
router.delete('/:id', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const existing = await db.user.findFirst({
            where: { id: req.params.id, branchId: { not: null } }
        });

        if (!existing) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        // Prevent deleting yourself
        if (existing.id === req.user.id) {
            return res.status(400).json({ error: 'لا يمكنك حذف حسابك الخاص' });
        }

        await db.user.delete({
            where: { id: req.params.id }
        });

        await logAction({
            entityType: 'USER',
            entityId: req.params.id,
            action: 'DELETE',
            details: `Deleted user: ${existing.displayName}`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: existing.branchId
        });

        res.json({ success: true, message: 'تم حذف المستخدم بنجاح' });
    } catch (error) {
        console.error('Failed to delete user:', error);
        res.status(500).json({ error: error.message || 'فشل في حذف المستخدم' });
    }
});

// POST reset user password (super admin only)
router.post('/:id/reset-password', authenticateToken, requireSuperAdmin, async (req, res) => {
    try {
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 6) {
            return res.status(400).json({ error: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' });
        }

        const existing = await db.user.findFirst({
            where: { id: req.params.id, branchId: { not: null } }
        });

        if (!existing) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.user.updateMany({
            where: { id: req.params.id, branchId: { not: null } },
            data: { password: hashedPassword }
        });

        await logAction({
            entityType: 'USER',
            entityId: req.params.id,
            action: 'PASSWORD_RESET',
            details: `Password reset for user: ${existing.displayName}`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: existing.branchId
        });

        res.json({ success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
    } catch (error) {
        console.error('Failed to reset password:', error);
        res.status(500).json({ error: error.message || 'فشل في إعادة تعيين كلمة المرور' });
    }
});

// GET available roles
router.get('/meta/roles', authenticateToken, async (req, res) => {
    const roles = [
        { value: 'SUPER_ADMIN', label: 'مدير النظام' },
        { value: 'MANAGEMENT', label: 'الإدارة' },
        { value: 'CENTER_MANAGER', label: 'مدير مركز الصيانة' },
        { value: 'CENTER_TECH', label: 'فني مركز الصيانة' },
        { value: 'BRANCH_MANAGER', label: 'مدير الفرع' },
        { value: 'BRANCH_TECH', label: 'فني الفرع' },
        { value: 'CS_SUPERVISOR', label: 'مشرف خدمة العملاء' },
        { value: 'CS_AGENT', label: 'موظف خدمة العملاء' },
        { value: 'ADMIN_AFFAIRS', label: 'شؤون إدارية' }
    ];
    res.json(roles);
});

module.exports = router;
