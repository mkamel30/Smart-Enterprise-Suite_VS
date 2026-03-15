/**
 * Branch Utility Functions
 */

/**
 * Get all authorized branch IDs for a user
 * @param {Object} user - User object from request
 * @returns {Array<String>} Array of branch IDs
 */
const getAuthorizedBranchIds = (user) => {
    if (!user) return [];
    if (user.authorizedBranchIds && Array.isArray(user.authorizedBranchIds)) {
        return user.authorizedBranchIds;
    }
    if (user.branchId) {
        return [user.branchId];
    }
    return [];
};

module.exports = {
    getAuthorizedBranchIds
};
