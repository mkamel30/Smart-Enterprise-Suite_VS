/**
 * Permissions utility for Frontend
 * Mirrors backend permissions for role-based UI rendering
 */

// Role definitions
export const ROLES = {
    // إدارة النظام
    SUPER_ADMIN: 'SUPER_ADMIN',       // مدير النظام - كل الصلاحيات
    MANAGEMENT: 'MANAGEMENT',          // الإدارة العليا
    BRANCH_ADMIN: 'BRANCH_ADMIN',      // إدارة الفروع
    ACCOUNTANT: 'ACCOUNTANT',          // الحسابات

    // الشئون الإدارية
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS',    // موظف الشئون الإدارية

    // مركز الصيانة
    CENTER_MANAGER: 'CENTER_MANAGER',  // مدير مركز الصيانة
    CENTER_TECH: 'CENTER_TECH',        // فني مركز الصيانة

    // الفرع - Customer Service
    BRANCH_MANAGER: 'BRANCH_MANAGER',  // مدير الفرع (Legacy - يُعامل كـ مشرف خدمة عملاء)
    CS_SUPERVISOR: 'CS_SUPERVISOR',    // مشرف خدمة العملاء
    CS_AGENT: 'CS_AGENT',              // موظف خدمة العملاء
    BRANCH_TECH: 'BRANCH_TECH',        // فني الفرع

    // Legacy (للتوافق مع البيانات القديمة)
    TECHNICIAN: 'TECHNICIAN'           // فني - لا يستخدم (الفني لا يدخل على النظام)
} as const;

// Legacy role mapping
export const LEGACY_ROLE_MAP: Record<string, string> = {
    'Admin': ROLES.SUPER_ADMIN,
    'Technician': ROLES.CS_AGENT, // Map old technicians to CS_AGENT
    'admin': ROLES.SUPER_ADMIN,
    'technician': ROLES.CS_AGENT,
    'TECHNICIAN': ROLES.CS_AGENT
};

// Normalize role (handle legacy roles)
export const normalizeRole = (role?: string | null): string => {
    if (!role) return ROLES.CS_AGENT;
    return LEGACY_ROLE_MAP[role] || role;
};

// Branch types
export const BRANCH_TYPES = {
    BRANCH: 'BRANCH',
    MAINTENANCE_CENTER: 'MAINTENANCE_CENTER',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS'
} as const;

// All branch/CS roles (for easier permission management)
const ALL_BRANCH_ROLES = [ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH];
const SUPERVISOR_AND_ABOVE = [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR];
const ALL_SYSTEM_ROLES = [
    ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN, ROLES.ACCOUNTANT,
    ROLES.ADMIN_AFFAIRS,
    ROLES.CENTER_MANAGER, ROLES.CENTER_TECH,
    ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
];

// Menu items by role
export const MENU_PERMISSIONS: Record<string, string[]> = {
    // Dashboard - everyone
    '/': ALL_SYSTEM_ROLES,

    // Executive Dashboard - Management only
    '/executive-dashboard': [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN],

    // Maintenance requests - branches and supervisors only
    '/requests': [
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Maintenance Shipments - Center only
    '/maintenance/shipments': [
        ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER, ROLES.CENTER_TECH
    ],

    // Maintenance Center - Center only (replaces maintenance-board)
    '/maintenance-center': [
        ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER, ROLES.CENTER_TECH
    ],
    '/maintenance-center/machine/:id': [
        ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER, ROLES.CENTER_TECH
    ],

    // Assignments - Center only (all center users)
    '/assignments': [
        ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER, ROLES.CENTER_TECH
    ],

    // Maintenance Approvals - Branches only
    '/maintenance-approvals': [
        ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR
    ],

    // Track Machines - Branches only (to track their machines at center)
    '/track-machines': [
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Pending Payments - Branches Only
    '/pending-payments': [
        ROLES.SUPER_ADMIN,
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR
    ],

    // Customers - branches
    '/customers': [
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Warehouse - Spare parts
    '/warehouse': [
        ROLES.CENTER_MANAGER, ROLES.CENTER_TECH,
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Warehouse - Machines
    '/warehouse-machines': [
        ROLES.ADMIN_AFFAIRS,
        ROLES.CENTER_MANAGER,
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Warehouse - SIMs (not for maintenance center)
    '/warehouse-sims': [
        ROLES.ADMIN_AFFAIRS,
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Transfer orders - create
    '/transfer-orders': [
        ROLES.ADMIN_AFFAIRS,
        ROLES.CENTER_MANAGER,
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Transfer orders - receive
    '/receive-orders': [
        ROLES.CENTER_MANAGER,
        ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
    ],

    // Admin Store - Administrative Affairs
    '/admin-store': [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.ADMIN_AFFAIRS],
    '/admin-store/settings': [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.ADMIN_AFFAIRS],

    // Finance - Sales & Receipts (Branches only)
    '/receipts': [...ALL_BRANCH_ROLES, ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN],
    '/payments': [...ALL_BRANCH_ROLES, ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN],

    // Reports - everyone except Admin Affairs
    '/reports': ALL_SYSTEM_ROLES.filter(role => role !== ROLES.ADMIN_AFFAIRS),

    // Admin section - Management only
    '/technicians': [ROLES.SUPER_ADMIN],
    '/approvals': [ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER],
    '/branches': [ROLES.SUPER_ADMIN],
    '/settings': [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Backups - SUPER_ADMIN only
    '/admin/backups': [ROLES.SUPER_ADMIN]
};

// Action-level permissions (for UI buttons)
export const ACTION_PERMISSIONS = {
    // Requests
    CREATE_REQUEST: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    CLOSE_REQUEST: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    DELETE_REQUEST: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Machines
    EXCHANGE_MACHINE: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    RETURN_MACHINE: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    SELL_MACHINE: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],
    ADD_MACHINE: [ROLES.SUPER_ADMIN, ROLES.ADMIN_AFFAIRS, ROLES.CENTER_MANAGER],
    DELETE_MACHINE: [ROLES.SUPER_ADMIN, ROLES.ADMIN_AFFAIRS],

    // SIMs
    EXCHANGE_SIM: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    ADD_SIM: [ROLES.SUPER_ADMIN, ROLES.ADMIN_AFFAIRS],
    DELETE_SIM: [ROLES.SUPER_ADMIN, ROLES.ADMIN_AFFAIRS],

    // Transfer Orders
    CREATE_TRANSFER: [ROLES.SUPER_ADMIN, ROLES.ADMIN_AFFAIRS, ROLES.CENTER_MANAGER, ...ALL_BRANCH_ROLES],
    RECEIVE_TRANSFER: [ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER, ...ALL_BRANCH_ROLES],
    REJECT_TRANSFER: [ROLES.SUPER_ADMIN, ROLES.CENTER_MANAGER, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Customers
    ADD_CUSTOMER: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    EDIT_CUSTOMER: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    DELETE_CUSTOMER: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Financial
    VIEW_PAYMENTS: SUPERVISOR_AND_ABOVE,
    ADD_PAYMENT: [ROLES.SUPER_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // System
    MANAGE_USERS: [ROLES.SUPER_ADMIN],
    MANAGE_BRANCHES: [ROLES.SUPER_ADMIN],
    VIEW_ALL_BRANCHES: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT],
    VIEW_EXECUTIVE_SUMMARY: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT],
    VIEW_BRANCH_RANKINGS: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT],
    VIEW_INVENTORY_VALUATION: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT]
};

/**
 * Check if user can access a specific route
 */
export const canAccessRoute = (role: string | undefined | null, path: string): boolean => {
    const normalizedRole = normalizeRole(role);
    const allowedRoles = MENU_PERMISSIONS[path];

    if (!allowedRoles) return true; // If not defined, allow
    return allowedRoles.includes(normalizedRole);
};

/**
 * Check if user can perform a specific action
 */
export const canPerformAction = (role: string | undefined | null, action: keyof typeof ACTION_PERMISSIONS): boolean => {
    const normalizedRole = normalizeRole(role);
    const allowedRoles = ACTION_PERMISSIONS[action] as string[];
    return allowedRoles?.includes(normalizedRole) ?? false;
};

/**
 * Get visible menu items for a role
 */
export const getVisibleMenuItems = (role: string | undefined | null) => {
    const normalizedRole = normalizeRole(role);

    return Object.entries(MENU_PERMISSIONS)
        .filter(([, roles]) => roles.includes(normalizedRole))
        .map(([path]) => path);
};

/**
 * Check if user is admin
 */
export const isAdmin = (role: string | undefined | null): boolean => {
    return normalizeRole(role) === ROLES.SUPER_ADMIN;
};

/**
 * Check if user is management
 */
export const isManagement = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === ROLES.MANAGEMENT || normalizedRole === ROLES.SUPER_ADMIN;
};

/**
 * Check if user works in maintenance center
 */
export const isMaintenanceCenter = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === ROLES.CENTER_MANAGER || normalizedRole === ROLES.CENTER_TECH;
};

/**
 * Check if user works in branch (Customer Service)
 */
export const isBranchUser = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return [ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT].includes(normalizedRole as any);
};

/**
 * Check if user is supervisor or above (can delete, view reports, etc.)
 */
export const isSupervisorOrAbove = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return [
        ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN,
        ROLES.ACCOUNTANT, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR,
        ROLES.CENTER_MANAGER
    ].includes(normalizedRole as any);
};

/**
 * Get role display name in Arabic
 */
export const getRoleDisplayName = (role: string | undefined | null): string => {
    const roleNames: Record<string, string> = {
        [ROLES.SUPER_ADMIN]: 'مدير النظام',
        [ROLES.MANAGEMENT]: 'الإدارة',
        [ROLES.BRANCH_ADMIN]: 'إدارة الفروع',
        [ROLES.ACCOUNTANT]: 'الحسابات',
        [ROLES.ADMIN_AFFAIRS]: 'الشئون الإدارية',
        [ROLES.CENTER_MANAGER]: 'مدير مركز الصيانة',
        [ROLES.CENTER_TECH]: 'فني مركز الصيانة',
        [ROLES.BRANCH_MANAGER]: 'مدير فرع',
        [ROLES.CS_SUPERVISOR]: 'مشرف خدمة العملاء',
        [ROLES.CS_AGENT]: 'موظف خدمة العملاء',
        [ROLES.BRANCH_TECH]: 'فني الفرع',
        [ROLES.TECHNICIAN]: 'موظف خدمة العملاء' // Legacy mapping
    };
    return roleNames[normalizeRole(role)] || 'مستخدم';
};

/**
 * Get all available roles for user creation dropdown
 */
export const getAvailableRoles = () => [
    { value: ROLES.CS_AGENT, label: 'موظف خدمة العملاء' },
    { value: ROLES.BRANCH_TECH, label: 'فني الفرع' },
    { value: ROLES.CS_SUPERVISOR, label: 'مشرف خدمة العملاء' },
    { value: ROLES.BRANCH_MANAGER, label: 'مدير فرع' },
    { value: ROLES.CENTER_TECH, label: 'فني مركز الصيانة' },
    { value: ROLES.CENTER_MANAGER, label: 'مدير مركز الصيانة' },
    { value: ROLES.ADMIN_AFFAIRS, label: 'الشئون الإدارية' },
    { value: ROLES.ACCOUNTANT, label: 'الحسابات' },
    { value: ROLES.BRANCH_ADMIN, label: 'إدارة الفروع' },
    { value: ROLES.MANAGEMENT, label: 'الإدارة' },
    { value: ROLES.SUPER_ADMIN, label: 'مدير النظام' }
];
