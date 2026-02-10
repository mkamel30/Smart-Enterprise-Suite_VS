/**
 * Shared Constants
 * Single source of truth for roles, machine statuses, and branch types.
 * Import these everywhere instead of using hardcoded strings.
 */

// ===================== USER ROLES =====================
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

// Roles that bypass branch filtering (global visibility)
const GLOBAL_ROLES = [ROLES.SUPER_ADMIN, ROLES.MANAGEMENT];

// Roles that manage the maintenance center
const CENTER_ROLES = [ROLES.CENTER_MANAGER, ROLES.CENTER_TECH];

// All roles with elevated privileges
const PRIVILEGED_ROLES = [...GLOBAL_ROLES, ROLES.CENTER_MANAGER, ROLES.CS_SUPERVISOR];

// ===================== BRANCH TYPES =====================
const BRANCH_TYPES = {
    BRANCH: 'BRANCH',
    MAINTENANCE_CENTER: 'MAINTENANCE_CENTER',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS'
};

// ===================== MACHINE STATUSES =====================
const MACHINE_STATUS = {
    NEW: 'NEW',
    STANDBY: 'STANDBY',
    DEPLOYED: 'DEPLOYED',
    CLIENT_REPAIR: 'CLIENT_REPAIR',
    AT_CENTER: 'AT_CENTER',
    EXTERNAL_REPAIR: 'EXTERNAL_REPAIR',
    UNDER_INSPECTION: 'UNDER_INSPECTION',
    REPAIRING: 'REPAIRING',
    REPAIRED: 'REPAIRED',
    WAITING_APPROVAL: 'WAITING_APPROVAL',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    TOTAL_LOSS: 'TOTAL_LOSS',
    RETURNED: 'RETURNED',
    SOLD: 'SOLD',
    SCRAPPED: 'SCRAPPED'
};

// ===================== REQUEST STATUSES =====================
const REQUEST_STATUS = {
    NEW: 'NEW',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    COMPLETED: 'COMPLETED',
    CLOSED: 'CLOSED',
    CANCELLED: 'CANCELLED'
};

// ===================== TRANSFER STATUSES =====================
const TRANSFER_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    SHIPPED: 'SHIPPED',
    RECEIVED: 'RECEIVED',
    REJECTED: 'REJECTED',
    CANCELLED: 'CANCELLED'
};

// ===================== HELPER FUNCTIONS =====================

/**
 * Check if a role has global (cross-branch) access
 */
function isGlobalRole(role) {
    return GLOBAL_ROLES.includes(role);
}

/**
 * Check if a role is a maintenance center role
 */
function isCenterRole(role) {
    return CENTER_ROLES.includes(role);
}

/**
 * Check if a role is privileged (Admin/Management/CenterManager/Supervisor)
 */
function isPrivilegedRole(role) {
    return PRIVILEGED_ROLES.includes(role);
}

module.exports = {
    ROLES,
    GLOBAL_ROLES,
    CENTER_ROLES,
    PRIVILEGED_ROLES,
    BRANCH_TYPES,
    MACHINE_STATUS,
    REQUEST_STATUS,
    TRANSFER_STATUS,
    isGlobalRole,
    isCenterRole,
    isPrivilegedRole
};
