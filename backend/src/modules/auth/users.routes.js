/**
 * Users Route
 * 
 * Provides user management endpoints.
 */

const express = require('express');
const router = express.Router();
const db = require('../../../db');
const bcrypt = require('bcryptjs');
const { authenticateToken, requireAdmin, requireSuperAdmin } = require('../../../middleware/auth');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { ROLES, isGlobalRole } = require('../../../utils/constants');
const { logAction } = require('../../../utils/logger');
const asyncHandler = require('../../../utils/asyncHandler');
const { parsePaginationParams = (q) => ({ limit: parseInt(q.limit) || 20, offset: parseInt(q.offset) || 0 }) } = require('../../../utils/pagination');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });
const { importUsers } = require('../shared/importExport.service');
const { exportEntitiesToExcel, transformUsersForExport, setExcelHeaders, generateExportFilename } = require('../../../utils/excel');
const adminSyncService = require('../../../services/adminSync.service');

// GET all users (admin only) - PAGINATED
router.get('/', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { branchId, role, isActive } = req.query;
    const { limit, offset } = parsePaginationParams(req.query);

    const where = {};

    // Branch filtering based on user role
    const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
    const isUserGlobal = isGlobalRole(req.user.role);

    if (isUserGlobal) {
        // Global administrative roles see all users
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

    const [users, total] = await Promise.all([
        db.user.findMany({
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
            take: limit,
            skip: offset,
            orderBy: { displayName: 'asc' }
        }),
        db.user.count({ where })
    ]);

    return paginated(res, users, total, limit, offset);
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
        return error(res, 'المستخدم غير موجود', 404);
    }

    return success(res, user);
}));

// POST create user (super admin only)
router.post('/', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    const { email, displayName, password, role, branchId, canDoMaintenance } = req.body;

    // Admin roles don't require a specific branchId (HQ/Global)
    const isAdminRole = isGlobalRole(role);

    // If it's a Branch Tech, email and password are optional
    const isVirtualUser = role === ROLES.BRANCH_TECH;

    if (!displayName) {
        return res.status(400).json({ error: 'الاسم مطلوب' });
    }

    if (!isVirtualUser && !email) {
        return res.status(400).json({ error: 'البريد الإلكتروني مطلوب للمستخدمين النشطين' });
    }

    // Check for duplicate email if one is provided
    if (email) {
        const existing = await db.user.findFirst({
            where: { email }
        });
        if (existing) {
            return res.status(400).json({ error: 'البريد الإلكتروني مسجل مسبقاً' });
        }
    }

    // Hash password if provided, otherwise for virtual users use a dummy
    let hashedPassword = null;
    if (password) {
        hashedPassword = await bcrypt.hash(password, 10);
    } else if (!isVirtualUser) {
        // Active users need a default password to prevent potential login/re-auth loops
        hashedPassword = await bcrypt.hash('1234567890Aa!', 10);
    }

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

    // Sync newly created user to Central Admin
    adminSyncService.syncUserToAdmin(user);

    return success(res, user, 201);
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
        const passwordValidation = require('../../../utils/passwordPolicy').validatePasswordStrength(password);
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

    // Sync updated user to Central Admin
    if (updated) {
        adminSyncService.syncUserToAdmin(updated);
    }

    return success(res, updated);
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

    return success(res, { success: true, message: 'تم حذف المستخدم بنجاح' });
}));

// POST reset user password (super admin only)
router.post('/:id/reset-password', authenticateToken, requireSuperAdmin, asyncHandler(async (req, res) => {
    const { newPassword } = req.body;

    const passwordValidation = require('../../../utils/passwordPolicy').validatePasswordStrength(newPassword);
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

    return success(res, { success: true, message: 'تم إعادة تعيين كلمة المرور بنجاح' });
}));

// GET available roles
router.get('/meta/roles', authenticateToken, async (req, res) => {
    const roles = [
        { value: ROLES.SUPER_ADMIN, label: 'مدير النظام' },
        { value: ROLES.MANAGEMENT, label: 'الإدارة' },
        { value: ROLES.ADMIN_AFFAIRS, label: 'شؤون إدارية' },
        { value: ROLES.BRANCH_MANAGER, label: 'مدير الفرع' },
        { value: ROLES.CS_SUPERVISOR, label: 'مشرف خدمة العملاء' },
        { value: ROLES.CS_AGENT, label: 'موظف خدمة العملاء' },
        { value: ROLES.BRANCH_TECH, label: 'فني الفرع' },
        { value: ROLES.TECHNICIAN, label: 'فني صيانة' }
    ];
    return success(res, roles);
});

// POST import users (super admin only)
router.post('/import', authenticateToken, requireSuperAdmin, upload.single('file'), asyncHandler(async (req, res) => {
    if (!req.file) return error(res, 'يرجى رفع ملف', 400);
    const results = await importUsers(req.file.buffer, req.user);
    return success(res, results);
}));

// GET export users
router.get('/export', authenticateToken, requireAdmin, asyncHandler(async (req, res) => {
    const { branchId, role } = req.query;
    const isActive = req.query.isActive === 'true';

    const where = {};
    if (branchId) where.branchId = branchId;
    if (role) where.role = role;
    if (req.query.isActive !== undefined) where.isActive = isActive;

    const users = await db.user.findMany({
        where,
        include: { branch: true },
        orderBy: { displayName: 'asc' }
    });

    const transformed = transformUsersForExport(users);
    const buffer = await exportEntitiesToExcel(transformed, 'users', 'users.xlsx');

    setExcelHeaders(res, generateExportFilename('users'));
    return res.send(buffer);
}));

module.exports = router;
