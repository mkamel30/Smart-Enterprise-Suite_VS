/**
 * System-wide Constants and Enums
 */

const ROLES = {
    SUPER_ADMIN: 'SUPER_ADMIN',
    MANAGEMENT: 'MANAGEMENT',
    BRANCH_ADMIN: 'BRANCH_ADMIN',
    ACCOUNTANT: 'ACCOUNTANT',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS',
    BRANCH_MANAGER: 'BRANCH_MANAGER',
    CS_SUPERVISOR: 'CS_SUPERVISOR',
    CS_AGENT: 'CS_AGENT',
    BRANCH_TECH: 'BRANCH_TECH',
    TECHNICIAN: 'TECHNICIAN'
};

const BRANCH_TYPES = {
    BRANCH: 'BRANCH',
    MAINTENANCE_CENTER: 'MAINTENANCE_CENTER',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS'
};

const REQUEST_STATUS = {
    OPEN: 'Open',
    IN_PROGRESS: 'In Progress',
    PENDING: 'Pending',
    DONE: 'Done',
    CLOSED: 'Closed',
    CANCELLED: 'Cancelled'
};

const TRANSFER_STATUS = {
    PENDING: 'PENDING',
    IN_TRANSIT: 'IN_TRANSIT',
    COMPLETED: 'COMPLETED',
    RECEIVED: 'RECEIVED', // System supports RECEIVED as well
    CANCELLED: 'CANCELLED',
    REJECTED: 'REJECTED'
};

const DEBT_STATUS = {
    PENDING: 'PENDING',
    PAID: 'PAID',
    CANCELLED: 'CANCELLED'
};

const MACHINE_STATUS = {
    NEW: 'NEW',
    STANDBY: 'STANDBY',
    ASSIGNED: 'ASSIGNED',
    UNDER_MAINTENANCE: 'UNDER_MAINTENANCE',
    REPAIRED: 'REPAIRED',
    READY_FOR_PICKUP: 'READY_FOR_PICKUP',
    TOTAL_LOSS: 'TOTAL_LOSS',
    SCRAPPED: 'SCRAPPED',
    SOLD: 'SOLD',
    DISPOSED: 'DISPOSED',
    IN_TRANSIT: 'IN_TRANSIT',
    LOST: 'LOST',
    STOLEN: 'STOLEN'
};

const APPROVAL_STATUS = {
    PENDING: 'PENDING',
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED'
};

const ASSET_STATUS = {
    IN_ADMIN_STORE: 'IN_ADMIN_STORE',
    TRANSFERRED: 'TRANSFERRED',
    DISPOSED: 'DISPOSED',
    IN_USE: 'IN_USE'
};

/**
 * Check if a role is a global/admin role (authorized for all branches)
 * @param {string} role - User role string
 * @returns {boolean}
 */
const isGlobalRole = (role) => {
    return [
        ROLES.SUPER_ADMIN,
        ROLES.MANAGEMENT,
        ROLES.BRANCH_ADMIN,
        ROLES.ACCOUNTANT,
        ROLES.ADMIN_AFFAIRS,
        ROLES.CS_SUPERVISOR
    ].includes(role);
};

module.exports = {
    ROLES,
    BRANCH_TYPES,
    REQUEST_STATUS,
    TRANSFER_STATUS,
    DEBT_STATUS,
    MACHINE_STATUS,
    APPROVAL_STATUS,
    ASSET_STATUS,
    isGlobalRole
};
