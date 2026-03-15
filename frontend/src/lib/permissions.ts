/**
 * Permissions utility for Frontend
 * Mirrors backend permissions for role-based UI rendering
 */

// Role definitions
export const ROLES = {
    // إدارة النظام
    SUPER_ADMIN: 'SUPER_ADMIN',       // مدير النظام - كل الصلاحيات
    MANAGEMENT: 'MANAGEMENT',          // الإدارة العليا
    BRANCH_ADMIN: 'BRANCH_ADMIN',      // إدارة الفرع (أدمن الفرع)
    ACCOUNTANT: 'ACCOUNTANT',          // الحسابات

    // الفرع - Customer Service
    BRANCH_MANAGER: 'BRANCH_MANAGER',  // مدير الفرع
    CS_SUPERVISOR: 'CS_SUPERVISOR',    // مشرف خدمة العملاء
    CS_AGENT: 'CS_AGENT',              // موظف خدمة العملاء
    BRANCH_TECH: 'BRANCH_TECH',        // فني الفرع

    // Legacy (للتوافق مع البيانات القديمة)
    TECHNICIAN: 'TECHNICIAN'           // فني - لا يستخدم (الفني لا يدخل على النظام)
} as const;

// Legacy role mapping
export const LEGACY_ROLE_MAP: Record<string, string> = {
    'Admin': ROLES.SUPER_ADMIN,
    'Technician': ROLES.CS_AGENT,
    'admin': ROLES.SUPER_ADMIN,
    'technician': ROLES.CS_AGENT,
    'TECHNICIAN': ROLES.CS_AGENT,
    'CENTER_MANAGER': ROLES.BRANCH_ADMIN,
    'CENTER_TECH': ROLES.BRANCH_TECH,
    'ADMIN_AFFAIRS': ROLES.BRANCH_ADMIN
};

// Normalize role (handle legacy roles)
export const normalizeRole = (role?: string | null): string => {
    if (!role) return ROLES.CS_AGENT;
    return LEGACY_ROLE_MAP[role] || role;
};

// Branch types
export const BRANCH_TYPES = {
    BRANCH: 'BRANCH'
} as const;

// All branch roles
const ALL_BRANCH_ROLES = [ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH];
const SUPERVISOR_AND_ABOVE = [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR];
const ALL_SYSTEM_ROLES = [
    ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_ADMIN, ROLES.ACCOUNTANT,
    ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR, ROLES.CS_AGENT, ROLES.BRANCH_TECH
];

// Menu items by role
export const MENU_PERMISSIONS: Record<string, string[]> = {
    // Dashboard - everyone
    '/': ALL_SYSTEM_ROLES,

    // Maintenance requests
    '/requests': ALL_BRANCH_ROLES,

    // Customers
    '/customers': ALL_BRANCH_ROLES,

    // Warehouse - Spare parts
    '/warehouse': ALL_BRANCH_ROLES,

    // Warehouse - Machines
    '/warehouse-machines': ALL_BRANCH_ROLES,

    // Warehouse - SIMs
    '/warehouse-sims': ALL_BRANCH_ROLES,

    // Monthly Closing Report
    '/monthly-closing': ALL_SYSTEM_ROLES,

    // Transfer orders
    '/transfer-orders': ALL_BRANCH_ROLES,

    // Transfer orders - receive
    '/receive-orders': ALL_BRANCH_ROLES,

    // Finance - Sales & Receipts
    '/receipts': [...ALL_BRANCH_ROLES, ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN],
    '/payments': [...ALL_BRANCH_ROLES, ROLES.ACCOUNTANT, ROLES.SUPER_ADMIN],

    // Reports
    '/reports': ALL_SYSTEM_ROLES,

    // Admin section
    '/technicians': [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN],
    '/branches': [ROLES.SUPER_ADMIN],
    '/settings': [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Backups
    '/admin/backups': [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN]
};

// Action-level permissions (for UI buttons)
export const ACTION_PERMISSIONS = {
    // Requests
    CREATE_REQUEST: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    CLOSE_REQUEST: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    DELETE_REQUEST: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Machines
    EXCHANGE_MACHINE: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    RETURN_MACHINE: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    SELL_MACHINE: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],
    ADD_MACHINE: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN],
    DELETE_MACHINE: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN],

    // SIMs
    EXCHANGE_SIM: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    ADD_SIM: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN],
    DELETE_SIM: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN],

    // Transfer Orders
    CREATE_TRANSFER: [ROLES.SUPER_ADMIN, ...ALL_BRANCH_ROLES],
    RECEIVE_TRANSFER: [ROLES.SUPER_ADMIN, ...ALL_BRANCH_ROLES],
    REJECT_TRANSFER: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Customers
    ADD_CUSTOMER: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    EDIT_CUSTOMER: [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ...ALL_BRANCH_ROLES],
    DELETE_CUSTOMER: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // Financial
    VIEW_PAYMENTS: SUPERVISOR_AND_ABOVE,
    ADD_PAYMENT: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR],

    // System
    MANAGE_USERS: [ROLES.SUPER_ADMIN, ROLES.BRANCH_ADMIN],
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
 * Check if user can find menu items
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
    const normalizedRole = normalizeRole(role);
    return normalizedRole === ROLES.SUPER_ADMIN || normalizedRole === ROLES.BRANCH_ADMIN;
};

/**
 * Check if user is management
 */
export const isManagement = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === ROLES.MANAGEMENT || normalizedRole === ROLES.SUPER_ADMIN;
};

/**
 * Check if user is maintenance center (NOT USED in branch app, but keeping for compatibility)
 */
export const isMaintenanceCenter = (_role: string | undefined | null): boolean => {
    return false;
};

/**
 * Check if user works in branch (Customer Service)
 */
export const isBranchUser = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return ALL_BRANCH_ROLES.includes(normalizedRole as any);
};

/**
 * Check if user is supervisor or above (can delete, view reports, etc.)
 */
export const isSupervisorOrAbove = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return SUPERVISOR_AND_ABOVE.includes(normalizedRole as any);
};

/**
 * Check if user has global access (can view all branches)
 */
export const isGlobalRole = (role: string | undefined | null): boolean => {
    const normalizedRole = normalizeRole(role);
    return [
        ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.ACCOUNTANT
    ].includes(normalizedRole as any);
};

/**
 * Get role display name in Arabic
 */
export const getRoleDisplayName = (role: string | undefined | null): string => {
    const roleNames: Record<string, string> = {
        [ROLES.SUPER_ADMIN]: 'مدير النظام الرئيسي',
        [ROLES.MANAGEMENT]: 'الإدارة العليا',
        [ROLES.BRANCH_ADMIN]: 'مدير الفرع (أدمن)',
        [ROLES.ACCOUNTANT]: 'المحاسب المالي',
        [ROLES.BRANCH_MANAGER]: 'رئيس الفرع',
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
    { value: ROLES.BRANCH_MANAGER, label: 'رئيس الفرع' },
    { value: ROLES.BRANCH_ADMIN, label: 'مدير الفرع (أدمن)' },
    { value: ROLES.ACCOUNTANT, label: 'المحاسب المالي' },
    { value: ROLES.MANAGEMENT, label: 'الإدارة العليا' },
    { value: ROLES.SUPER_ADMIN, label: 'مدير النظام الرئيسي' }
];
