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

    // Support hierarchy
    const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);

    if (authorizedIds.length > 0) {
        return {
            branchId: authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds }
        };
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
    const centralRoles = ['SUPER_ADMIN', 'MANAGEMENT'];
    if (centralRoles.includes(req.user.role)) {
        return true;
    }

    // Support hierarchy
    const authorizedIds = req.user.authorizedBranchIds || (req.user.branchId ? [req.user.branchId] : []);
    return authorizedIds.includes(targetBranchId);
};

module.exports = {
    getBranchFilter,
    canAccessBranch
};
