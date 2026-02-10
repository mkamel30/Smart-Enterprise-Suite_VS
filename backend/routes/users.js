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
const asyncHandler = require('../utils/asyncHandler');

// GET all users (admin only)
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { branchId, role, isActive } = req.query;

    const where = {};

    // Branch filtering based on user role
    const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
    if (req.user.role === 'SUPER_ADMIN') {
        // Super admin can see ALL users (including those with null branchId)
        if (branchId) where.branchId = branchId;
        // If no filter, show all users (including admin users without branch)
    } else if (['MANAGEMENT', 'ADMIN_AFFAIRS'].includes(req.user.role)) {
        // These roles also see all for now, but following the pattern
        if (branchId) {
            where.branchId = branchId;
        }
    } else {
        // Support hierarchy: filter by authorized branches
        if (branchId) {
            // If specific branch requested, check if it's authorized
            where.branchId = authorizedIds.includes(branchId) ? branchId : 'FORBIDDEN';
        } else {
            where.branchId = authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds };
        }
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
            isActive: true,
            createdAt: true,
            branch: {
                select: { id: true, name: true, code: true }
            }
        },
        orderBy: { displayName: 'asc' }
    });

    res.json(users);
}));

// GET single user
router.get('/:id', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    // Super admin can see any user
    const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
    const whereClause = req.user.role === 'SUPER_ADMIN'
        ? { id: req.params.id }
        : { id: req.params.id, branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds } };

    const user = await db.user.findFirst({
        where: whereClause,
        select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            branchId: true,
            canDoMaintenance: true,
            isActive: true,
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
}));

// POST create user (super admin only)
router.post('/', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
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

    // Validate password (use policy)
    const passwordToValidate = password || '1234567890Aa!'; // Default must meet 12 chars if none provided
    const passwordValidation = require('../utils/passwordPolicy').validatePasswordStrength(passwordToValidate);
    if (!passwordValidation.isValid) {
        return res.status(400).json({
            error: 'كلمة المرور غير صالحة',
            details: passwordValidation.errors
        });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(passwordToValidate, 10);

    const user = await db.user.create({
        data: {
            email,
            displayName,
            password: hashedPassword,
            role: role || 'CS_AGENT',
            branchId: branchId || null,
            canDoMaintenance: canDoMaintenance || false,
            isActive: true // Default to active
        },
        select: {
            id: true,
            email: true,
            displayName: true,
            role: true,
            branchId: true,
            canDoMaintenance: true,
            isActive: true,
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
}));

// PUT update user (super admin only)
router.put('/:id', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
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
    if (req.body.isActive !== undefined) updateData.isActive = req.body.isActive === true || req.body.isActive === 'true';

    if (password) {
        const passwordValidation = require('../utils/passwordPolicy').validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({
                error: 'كلمة المرور لا تستوفي شروط الأمان',
                details: passwordValidation.errors
            });
        }
        updateData.password = await bcrypt.hash(password, 10);
        updateData.passwordChangedAt = new Date();
    }

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
            isActive: true,
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
}));

// DELETE user (super admin only)
router.delete('/:id', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
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
}));

// POST reset user password (super admin only)
router.post('/:id/reset-password', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    const passwordValidation = require('../utils/passwordPolicy').validatePasswordStrength(newPassword);
    if (!passwordValidation.isValid) {
        return res.status(400).json({
            error: 'كلمة المرور غير صالحة',
            details: passwordValidation.errors
        });
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
}));

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
