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
            // Super admin can see ALL users (including those with null branchId)
            if (branchId) where.branchId = branchId;
            // If no filter, show all users (including admin users without branch)
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
        // Super admin can see any user
        const whereClause = req.user.role === 'SUPER_ADMIN'
            ? { id: req.params.id }
            : { id: req.params.id, branchId: req.user.branchId };

        const user = await db.user.findFirst({
            where: whereClause,
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

        // Admin roles (SUPER_ADMIN, MANAGEMENT) don't require branchId
        const isAdminRole = ['SUPER_ADMIN', 'MANAGEMENT'].includes(role);

        if (!email || !displayName) {
            return res.status(400).json({ error: 'البريد الإلكتروني والاسم مطلوبين' });
        }

        // Non-admin roles require branchId
        if (!isAdminRole && !branchId) {
            return res.status(400).json({ error: 'يجب تحديد الفرع للمستخدمين غير الإداريين' });
        }

        // Check for duplicate email (search in all users)
        const existing = await db.user.findFirst({
            where: { email }
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
                branchId: branchId || null, // Allow null for admin roles
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
            details: `Created user: ${user.displayName} (${role})`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: branchId || req.user.branchId
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
            where: { id: req.params.id }
        });

        if (!existing) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        const updateData = {};
        if (displayName) updateData.displayName = displayName;
        if (role) updateData.role = role;
        // Allow setting branchId to null for admin roles
        if (branchId !== undefined) updateData.branchId = branchId || null;
        if (canDoMaintenance !== undefined) updateData.canDoMaintenance = canDoMaintenance;
        if (password) updateData.password = await bcrypt.hash(password, 10);

        await db.user.update({
            where: { id: req.params.id },
            data: updateData
        });

        const updated = await db.user.findFirst({
            where: { id: req.params.id },
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
            branchId: updated?.branchId || req.user.branchId
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
            where: { id: req.params.id }
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
            branchId: existing.branchId || req.user.branchId
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
            where: { id: req.params.id }
        });

        if (!existing) {
            return res.status(404).json({ error: 'المستخدم غير موجود' });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);

        await db.user.update({
            where: { id: req.params.id },
            data: { password: hashedPassword }
        });

        await logAction({
            entityType: 'USER',
            entityId: req.params.id,
            action: 'PASSWORD_RESET',
            details: `Password reset for user: ${existing.displayName}`,
            userId: req.user.id,
            performedBy: req.user.displayName,
            branchId: existing.branchId || req.user.branchId
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
