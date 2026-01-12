/**
 * Permissions Middleware
 * Handles role-based access control for all routes
 */

// Role definitions with their permissions
const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    MANAGEMENT: 'MANAGEMENT',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS',
    CENTER_MANAGER: 'CENTER_MANAGER',
    CENTER_TECH: 'CENTER_TECH',
    BRANCH_MANAGER: 'BRANCH_MANAGER',
    CS_SUPERVISOR: 'CS_SUPERVISOR',
    CS_AGENT: 'CS_AGENT',
    BRANCH_TECH: 'BRANCH_TECH',
    TECHNICIAN: 'TECHNICIAN'
};

// Branch types
const BRANCH_TYPES = {
    BRANCH: 'BRANCH',
    MAINTENANCE_CENTER: 'MAINTENANCE_CENTER',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS'
};

// Permission definitions
const PERMISSIONS = {
    // Customer permissions
    CUSTOMERS_VIEW_ALL: 'customers:view:all',
    CUSTOMERS_VIEW_BRANCH: 'customers:view:branch',
    CUSTOMERS_MANAGE: 'customers:manage',

    // Maintenance permissions
    MAINTENANCE_VIEW_ALL: 'maintenance:view:all',
    MAINTENANCE_VIEW_BRANCH: 'maintenance:view:branch',
    MAINTENANCE_MANAGE_INTERNAL: 'maintenance:manage:internal',
    MAINTENANCE_MANAGE_EXTERNAL: 'maintenance:manage:external',

    // Inventory permissions
    INVENTORY_VIEW_ALL: 'inventory:view:all',
    INVENTORY_VIEW_BRANCH: 'inventory:view:branch',
    INVENTORY_MANAGE_NEW: 'inventory:manage:new',
    INVENTORY_MANAGE_PARTS: 'inventory:manage:parts',
    INVENTORY_RECEIVE: 'inventory:receive',

    // Transfer permissions
    TRANSFERS_VIEW_ALL: 'transfers:view:all',
    TRANSFERS_SEND_NEW: 'transfers:send:new',
    TRANSFERS_SEND_PARTS: 'transfers:send:parts',
    TRANSFERS_SEND_TO_CENTER: 'transfers:send:center',

    // Reports & Analytics permissions
    REPORTS_ALL: 'reports:all',
    REPORTS_BRANCH: 'reports:branch',
    ANALYTICS_VIEW_EXECUTIVE: 'analytics:view:executive',
    ANALYTICS_VIEW_RANKINGS: 'analytics:view:rankings',
    ANALYTICS_VIEW_INVENTORY: 'analytics:view:inventory',

    // User management
    USERS_MANAGE: 'users:manage',

    // Settings
    SETTINGS_MANAGE: 'settings:manage'
};

// Role to permissions mapping
const ROLE_PERMISSIONS = {
    [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),

    [ROLES.MANAGEMENT]: [
        PERMISSIONS.CUSTOMERS_VIEW_ALL,
        PERMISSIONS.MAINTENANCE_VIEW_ALL,
        PERMISSIONS.INVENTORY_VIEW_ALL,
        PERMISSIONS.TRANSFERS_VIEW_ALL,
        PERMISSIONS.REPORTS_ALL,
        PERMISSIONS.ANALYTICS_VIEW_EXECUTIVE,
        PERMISSIONS.ANALYTICS_VIEW_RANKINGS,
        PERMISSIONS.ANALYTICS_VIEW_INVENTORY
    ],

    [ROLES.ADMIN_AFFAIRS]: [
        PERMISSIONS.INVENTORY_MANAGE_NEW,
        PERMISSIONS.TRANSFERS_SEND_NEW,
        PERMISSIONS.INVENTORY_VIEW_ALL,
        PERMISSIONS.REPORTS_BRANCH,
        PERMISSIONS.TRANSFERS_VIEW_ALL
    ],

    [ROLES.CENTER_MANAGER]: [
        PERMISSIONS.MAINTENANCE_MANAGE_EXTERNAL,
        PERMISSIONS.INVENTORY_MANAGE_PARTS,
        PERMISSIONS.TRANSFERS_SEND_PARTS,
        PERMISSIONS.INVENTORY_VIEW_BRANCH,
        PERMISSIONS.REPORTS_BRANCH
    ],

    [ROLES.CENTER_TECH]: [
        PERMISSIONS.MAINTENANCE_MANAGE_EXTERNAL,
        PERMISSIONS.INVENTORY_VIEW_BRANCH
    ],

    [ROLES.BRANCH_MANAGER]: [
        PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
        PERMISSIONS.CUSTOMERS_MANAGE,
        PERMISSIONS.MAINTENANCE_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_MANAGE_INTERNAL,
        PERMISSIONS.INVENTORY_VIEW_BRANCH,
        PERMISSIONS.INVENTORY_RECEIVE,
        PERMISSIONS.TRANSFERS_SEND_TO_CENTER,
        PERMISSIONS.REPORTS_BRANCH
    ],

    [ROLES.CS_SUPERVISOR]: [
        PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
        PERMISSIONS.CUSTOMERS_MANAGE,
        PERMISSIONS.MAINTENANCE_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_MANAGE_INTERNAL,
        PERMISSIONS.INVENTORY_VIEW_BRANCH,
        PERMISSIONS.INVENTORY_RECEIVE,
        PERMISSIONS.TRANSFERS_SEND_TO_CENTER,
        PERMISSIONS.REPORTS_BRANCH
    ],

    [ROLES.CS_AGENT]: [
        PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_MANAGE_INTERNAL,
        PERMISSIONS.INVENTORY_VIEW_BRANCH
    ],

    [ROLES.BRANCH_TECH]: [
        PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_MANAGE_INTERNAL,
        PERMISSIONS.INVENTORY_VIEW_BRANCH
    ],

    [ROLES.TECHNICIAN]: [
        PERMISSIONS.CUSTOMERS_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_VIEW_BRANCH,
        PERMISSIONS.MAINTENANCE_MANAGE_INTERNAL,
        PERMISSIONS.INVENTORY_VIEW_BRANCH
    ]
};

/**
 * Check if user has a specific permission
 */
const hasPermission = (userRole, permission) => {
    const rolePerms = ROLE_PERMISSIONS[userRole] || [];
    return rolePerms.includes(permission);
};

/**
 * Check if user has any of the given permissions
 */
const hasAnyPermission = (userRole, permissions) => {
    return permissions.some(perm => hasPermission(userRole, perm));
};

/**
 * Middleware factory: require specific permission(s)
 */
const requirePermission = (...permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Authentication required' });
        }

        const userRole = req.user.role || ROLES.TECHNICIAN;

        // Super admin has all permissions
        if (userRole === ROLES.SUPER_ADMIN) {
            return next();
        }

        if (hasAnyPermission(userRole, permissions)) {
            return next();
        }

        return res.status(403).json({
            error: 'Permission denied',
            required: permissions,
            userRole
        });
    };
};

/**
 * Get branch filter based on user role
 * Returns filter object for Prisma queries
 */
const getBranchFilter = (req) => {
    const userRole = req.user?.role || ROLES.TECHNICIAN;
    const userBranchId = req.user?.branchId;

    // These roles can see all data
    if ([ROLES.SUPER_ADMIN, ROLES.MANAGEMENT].includes(userRole)) {
        // If branchId is passed in query, use it for filtering
        if (req.query.branchId) {
            return { branchId: req.query.branchId };
        }
        return {};
    }

    // All other roles see only their branch
    if (userBranchId) {
        return { branchId: userBranchId };
    }

    return {};
};

/**
 * Check if user can access a specific branch's data
 */
const canAccessBranch = async (req, branchId, db) => {
    const userRole = req.user?.role || ROLES.TECHNICIAN;
    const userBranchId = req.user?.branchId;

    // Admin and management can access all
    if ([ROLES.SUPER_ADMIN, ROLES.MANAGEMENT].includes(userRole)) {
        return true;
    }

    // Center manager can access serviced branches
    if (userRole === ROLES.CENTER_MANAGER && userBranchId) {
        // Check if the target branch is serviced by user's center
        const targetBranch = await db.branch.findUnique({
            where: { id: branchId },
            select: { maintenanceCenterId: true }
        });
        return targetBranch?.maintenanceCenterId === userBranchId || branchId === userBranchId;
    }

    // Branch users can only access their own branch
    return branchId === userBranchId;
};

/**
 * Check if a role has global access (can view all branches)
 */
const isGlobalRole = (role) => {
    const globalRoles = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CS_SUPERVISOR', 'CENTER_MANAGER'];
    return globalRoles.includes(role);
};

module.exports = {
    ROLES,
    BRANCH_TYPES,
    PERMISSIONS,
    ROLE_PERMISSIONS,
    hasPermission,
    hasAnyPermission,
    requirePermission,
    getBranchFilter,
    canAccessBranch,
    isGlobalRole
};
