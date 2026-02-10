const { ForbiddenError } = require('../utils/errors');

/**
 * Checks if a user has a global, cross-branch role.
 * @param {object} user - The user object from the request.
 * @returns {boolean}
 */
function userHasGlobalRole(user) {
    return ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS'].includes(user?.role);
}

/**
 * Generates a Prisma 'where' clause to enforce branch-level scoping.
 * Returns an empty object for global roles.
 * @param {object} user - The user object.
 * @param {string} [field='branchId'] - The field name to filter on (e.g., 'branchId', 'originBranchId').
 * @returns {object} Prisma where clause for branch scoping.
 */
function getBranchScope(user, field = 'branchId') {
    if (userHasGlobalRole(user) || !user?.branchId) {
        return {};
    }
    return { [field]: user.branchId };
}

/**
 * Checks if a user has access to a specific entity based on its branchId.
 * Throws ForbiddenError if access is denied.
 * @param {object} entity - The database entity (must have a branchId property).
 * @param {object} user - The user object.
 * @param {string} entityName - Name of the entity for error message.
 * @param {string} [field='branchId'] - The field name on the entity to check.
 */
function checkEntityAccess(entity, user, entityName, field = 'branchId') {
    if (userHasGlobalRole(user)) {
        return;
    }

    if (!user?.branchId) {
        throw new ForbiddenError(`User has no assigned branch.`);
    }

    if (!entity || entity[field] !== user.branchId) {
        throw new ForbiddenError(`Access denied to ${entityName}.`);
    }
}

module.exports = {
    userHasGlobalRole,
    getBranchScope,
    checkEntityAccess
};
