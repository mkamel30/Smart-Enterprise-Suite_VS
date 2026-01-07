/**
 * Centralized authentication and authorization helpers
 */

/**
 * Returns a Prisma 'where' clause for branch-level isolation
 * @param {Object} req - Express request object
 * @returns {Object} { branchId: string } or empty object for admins
 */
const getBranchFilter = (req) => {
    // List of roles that manage global/central operations
    const centralRoles = ['SUPER_ADMIN', 'MANAGEMENT'];

    if (centralRoles.includes(req.user.role)) {
        return {};
    }

    // For other roles (including ADMIN_AFFAIRS and CENTER_MANAGER), strictly filter by their assigned branch
    if (req.user.branchId) {
        return { branchId: req.user.branchId };
    }

    return {};
};

/**
 * Checks if a user has permission to manage a specific entity's branch
 * @param {Object} req - Express request object
 * @param {String} targetBranchId - The branchId of the entity being accessed
 * @returns {Boolean}
 */
const canAccessBranch = (req, targetBranchId) => {
    const centralRoles = ['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'];
    if (centralRoles.includes(req.user.role)) {
        return true;
    }
    return req.user.branchId === targetBranchId;
};

module.exports = {
    getBranchFilter,
    canAccessBranch
};
