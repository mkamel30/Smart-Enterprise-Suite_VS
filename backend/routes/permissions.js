const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Default permissions (fallback if not in database)
const DEFAULT_PAGE_PERMISSIONS = {
    '/': ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CENTER_MANAGER', 'CENTER_TECH', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/requests': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/customers': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/warehouse': ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER', 'CENTER_TECH', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/warehouse-machines': ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CENTER_MANAGER', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/warehouse-sims': ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/transfer-orders': ['SUPER_ADMIN', 'ADMIN_AFFAIRS', 'CENTER_MANAGER', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/receive-orders': ['SUPER_ADMIN', 'CENTER_MANAGER', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/receipts': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    '/payments': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    '/reports': ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CENTER_MANAGER', 'CENTER_TECH', 'CS_SUPERVISOR', 'CS_AGENT'],
    '/technicians': ['SUPER_ADMIN'],
    '/approvals': ['SUPER_ADMIN', 'CENTER_MANAGER'],
    '/branches': ['SUPER_ADMIN'],
    '/settings': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CS_SUPERVISOR']
};

const DEFAULT_ACTION_PERMISSIONS = {
    'CREATE_REQUEST': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'CLOSE_REQUEST': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'DELETE_REQUEST': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    'EXCHANGE_MACHINE': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'RETURN_MACHINE': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'SELL_MACHINE': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    'ADD_MACHINE': ['SUPER_ADMIN', 'ADMIN_AFFAIRS', 'CENTER_MANAGER'],
    'DELETE_MACHINE': ['SUPER_ADMIN', 'ADMIN_AFFAIRS'],
    'EXCHANGE_SIM': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'ADD_SIM': ['SUPER_ADMIN', 'ADMIN_AFFAIRS'],
    'DELETE_SIM': ['SUPER_ADMIN', 'ADMIN_AFFAIRS'],
    'CREATE_TRANSFER': ['SUPER_ADMIN', 'ADMIN_AFFAIRS', 'CENTER_MANAGER', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'RECEIVE_TRANSFER': ['SUPER_ADMIN', 'CENTER_MANAGER', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'REJECT_TRANSFER': ['SUPER_ADMIN', 'CENTER_MANAGER', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    'ADD_CUSTOMER': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'EDIT_CUSTOMER': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR', 'CS_AGENT'],
    'DELETE_CUSTOMER': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    'VIEW_PAYMENTS': ['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    'ADD_PAYMENT': ['SUPER_ADMIN', 'BRANCH_MANAGER', 'CS_SUPERVISOR'],
    'MANAGE_USERS': ['SUPER_ADMIN'],
    'MANAGE_BRANCHES': ['SUPER_ADMIN'],
    'VIEW_ALL_BRANCHES': ['SUPER_ADMIN', 'MANAGEMENT']
};

const ALL_ROLES = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CENTER_MANAGER', 'CENTER_TECH', 'CS_SUPERVISOR', 'CS_AGENT'];

// Get all permissions (merged from defaults + database overrides)
router.get('/', authenticateToken, async (req, res) => {
    try {
        // Get all database overrides
        const dbPermissions = await db.rolePermission.findMany();

        // Build permissions matrix
        const pagePermissions = {};
        const actionPermissions = {};

        // Start with defaults
        Object.keys(DEFAULT_PAGE_PERMISSIONS).forEach(page => {
            pagePermissions[page] = {};
            ALL_ROLES.forEach(role => {
                pagePermissions[page][role] = DEFAULT_PAGE_PERMISSIONS[page].includes(role);
            });
        });

        Object.keys(DEFAULT_ACTION_PERMISSIONS).forEach(action => {
            actionPermissions[action] = {};
            ALL_ROLES.forEach(role => {
                actionPermissions[action][role] = DEFAULT_ACTION_PERMISSIONS[action].includes(role);
            });
        });

        // Apply database overrides
        dbPermissions.forEach(perm => {
            if (perm.permissionType === 'PAGE' && pagePermissions[perm.permissionKey]) {
                pagePermissions[perm.permissionKey][perm.role] = perm.isAllowed;
            } else if (perm.permissionType === 'ACTION' && actionPermissions[perm.permissionKey]) {
                actionPermissions[perm.permissionKey][perm.role] = perm.isAllowed;
            }
        });

        res.json({
            pages: pagePermissions,
            actions: actionPermissions,
            roles: ALL_ROLES
        });
    } catch (error) {
        console.error('Error fetching permissions:', error);
        res.status(500).json({ error: 'Failed to fetch permissions' });
    }
});

// Update a single permission (Admin only)
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { role, permissionType, permissionKey, isAllowed } = req.body;

        if (!role || !permissionType || !permissionKey || typeof isAllowed !== 'boolean') {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Prevent removing SUPER_ADMIN from critical permissions
        if (role === 'SUPER_ADMIN' && !isAllowed) {
            const criticalPermissions = ['/', '/settings', '/technicians', '/branches', 'MANAGE_USERS', 'MANAGE_BRANCHES'];
            if (criticalPermissions.includes(permissionKey)) {
                return res.status(400).json({ error: 'Cannot remove SUPER_ADMIN from critical permissions' });
            }
        }

        // Upsert the permission
        const permission = await db.rolePermission.upsert({
            where: {
                role_permissionType_permissionKey: {
                    role,
                    permissionType,
                    permissionKey
                }
            },
            update: {
                isAllowed,
                updatedBy: req.user.displayName || req.user.id
            },
            create: {
                role,
                permissionType,
                permissionKey,
                isAllowed,
                updatedBy: req.user.displayName || req.user.id
            }
        });

        res.json(permission);
    } catch (error) {
        console.error('Error updating permission:', error);
        res.status(500).json({ error: 'Failed to update permission' });
    }
});

// Bulk update permissions (Admin only)
router.post('/bulk', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { permissions } = req.body; // Array of {role, permissionType, permissionKey, isAllowed}

        if (!Array.isArray(permissions)) {
            return res.status(400).json({ error: 'permissions must be an array' });
        }

        const results = await db.$transaction(
            permissions.map(perm =>
                db.rolePermission.upsert({
                    where: {
                        role_permissionType_permissionKey: {
                            role: perm.role,
                            permissionType: perm.permissionType,
                            permissionKey: perm.permissionKey
                        }
                    },
                    update: {
                        isAllowed: perm.isAllowed,
                        updatedBy: req.user.displayName || req.user.id
                    },
                    create: {
                        role: perm.role,
                        permissionType: perm.permissionType,
                        permissionKey: perm.permissionKey,
                        isAllowed: perm.isAllowed,
                        updatedBy: req.user.displayName || req.user.id
                    }
                })
            )
        );

        res.json({ updated: results.length });
    } catch (error) {
        console.error('Error bulk updating permissions:', error);
        res.status(500).json({ error: 'Failed to update permissions' });
    }
});

// Reset permissions to defaults (Admin only)
router.post('/reset', authenticateToken, requireAdmin, async (req, res) => {
    try {
        // Delete all custom permissions
        await db.rolePermission.deleteMany({});

        res.json({ message: 'Permissions reset to defaults' });
    } catch (error) {
        console.error('Error resetting permissions:', error);
        res.status(500).json({ error: 'Failed to reset permissions' });
    }
});

// Check if user has permission (for frontend validation)
router.get('/check', authenticateToken, async (req, res) => {
    try {
        const { type, key } = req.query;
        const userRole = req.user.role;

        if (!type || !key) {
            return res.status(400).json({ error: 'type and key are required' });
        }

        // Check database first
        const dbPerm = await db.rolePermission.findUnique({
            where: {
                role_permissionType_permissionKey: {
                    role: userRole,
                    permissionType: type,
                    permissionKey: key
                }
            }
        });

        if (dbPerm) {
            return res.json({ allowed: dbPerm.isAllowed });
        }

        // Fall back to defaults
        const defaults = type === 'PAGE' ? DEFAULT_PAGE_PERMISSIONS : DEFAULT_ACTION_PERMISSIONS;
        const allowed = defaults[key]?.includes(userRole) || false;

        res.json({ allowed });
    } catch (error) {
        console.error('Error checking permission:', error);
        res.status(500).json({ error: 'Failed to check permission' });
    }
});

module.exports = router;
