/**
 * Query Helpers Utility
 * 
 * Consolidates common query building patterns including branch filtering,
 * search filtering, and permission checks to reduce code duplication
 * across route files.
 */

const { getBranchFilter, isGlobalRole } = require('../middleware/permissions');
const { AppError } = require('./errorHandler');

/**
 * ROLES that have global access to all branches
 */
const GLOBAL_ROLES = ['SUPER_ADMIN', 'MANAGEMENT'];

/**
 * Build a where clause with branch filtering and optional additional filters
 * @param {Object} req - Express request object
 * @param {Object} options - Additional filtering options
 * @param {Object} options.additionalFilters - Additional Prisma where conditions
 * @param {string} options.search - Search term for text fields
 * @param {Array} options.searchFields - Fields to search (e.g., ['client_name', 'bkcode'])
 * @param {boolean} options.allowAdminOverride - Allow admins to skip branch filter with _skipBranchEnforcer
 * @returns {Object} Prisma-compatible where clause
 */
function buildWhereClause(req, options = {}) {
  const {
    additionalFilters = {},
    search,
    searchFields = [],
    allowAdminOverride = true
  } = options;

  const where = getBranchFilter(req);

  // Handle admin override for search operations
  const hasSearch = search && search.trim().length > 0;
  if (allowAdminOverride && hasSearch && GLOBAL_ROLES.includes(req.user?.role)) {
    where._skipBranchEnforcer = true;
    delete where.branchId;
  }

  // Add search filter if provided
  if (hasSearch && searchFields.length > 0) {
    const searchTerm = search.trim();
    const orConditions = searchFields.map(field => {
      if (field.includes('.')) {
        // Handle nested fields (e.g., 'customer.bkcode')
        const [parent, child] = field.split('.');
        return { [parent]: { [child]: { contains: searchTerm } } };
      }
      return { [field]: { contains: searchTerm } };
    });
    
    if (where.OR) {
      // Combine with existing OR conditions
      where.AND = [
        { OR: where.OR },
        { OR: orConditions }
      ];
      delete where.OR;
    } else {
      where.OR = orConditions;
    }
  }

  // Merge additional filters
  Object.assign(where, additionalFilters);

  return where;
}

/**
 * Build where clause for admin-only branch filtering
 * @param {Object} validated - Validated query parameters (e.g., from Zod schema)
 * @param {Object} req - Express request object
 * @param {Object} options - Additional filtering options
 * @returns {Object} Prisma-compatible where clause
 */
function buildAdminWhereClause(validated, req, options = {}) {
  const where = {};
  const userRole = req.user?.role;

  // Apply branch filter for non-super-admins
  const branchFilter = getBranchFilter(req);
  Object.assign(where, branchFilter);

  // Admin-only branch filtering from query params
  if (validated?.branchId) {
    if (!['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(userRole)) {
      throw new AppError('Insufficient permissions to filter by branch', 403, 'FORBIDDEN');
    }
    where.branchId = validated.branchId;
  }

  // Apply additional filters
  if (options.status && validated?.status) {
    where.status = validated.status;
  }

  if (options.customerId && validated?.customerId) {
    where.customerId = validated.customerId;
  }

  // Search filtering
  if (validated?.search && options.searchFields) {
    const s = validated.search;
    const searchConditions = options.searchFields.map(field => {
      if (typeof field === 'string' && field.includes('.')) {
        const [parent, child] = field.split('.');
        return { [parent]: { [child]: { contains: s } } };
      }
      return { [field]: { contains: s } };
    });
    where.OR = searchConditions;
  }

  return where;
}

/**
 * Check if user can access a specific branch
 * @param {Object} req - Express request object
 * @param {string} targetBranchId - Branch ID to check access for
 * @returns {boolean}
 */
function canAccessBranch(req, targetBranchId) {
  const userRole = req.user?.role;
  const userBranchId = req.user?.branchId;

  // Global roles can access all branches
  if (isGlobalRole(userRole)) {
    return true;
  }

  // Users can only access their own branch
  return targetBranchId === userBranchId;
}

/**
 * Validate branch access or throw error
 * @param {Object} req - Express request object
 * @param {string} targetBranchId - Branch ID to validate
 * @throws {AppError} If access is denied
 */
function requireBranchAccess(req, targetBranchId) {
  if (!canAccessBranch(req, targetBranchId)) {
    throw new AppError('Access denied', 403, 'FORBIDDEN');
  }
}

/**
 * Get pagination parameters with safe defaults
 * @param {Object} query - Query parameters (req.query)
 * @param {Object} defaults - Default values
 * @returns {Object} Safe pagination parameters
 */
function getPaginationParams(query, defaults = {}) {
  const maxLimit = defaults.maxLimit || 100;
  const defaultLimit = defaults.limit || 50;
  const defaultOffset = defaults.offset || 0;

  let limit = parseInt(query?.limit) || defaultLimit;
  let offset = parseInt(query?.offset) || defaultOffset;

  // Enforce safety limits
  limit = Math.min(limit, maxLimit);
  limit = Math.max(limit, 1);
  offset = Math.max(offset, 0);

  return { limit, offset };
}

/**
 * Build sort order for Prisma queries
 * @param {string} sortBy - Field to sort by
 * @param {string} sortOrder - 'asc' or 'desc'
 * @param {string} defaultField - Default sort field
 * @returns {Object} Prisma orderBy object
 */
function buildSortOrder(sortBy, sortOrder = 'desc', defaultField = 'createdAt') {
  const validOrders = ['asc', 'desc'];
  const order = validOrders.includes(sortOrder) ? sortOrder : 'desc';
  const field = sortBy || defaultField;
  
  return { [field]: order };
}

/**
 * Add date range filter to where clause
 * @param {Object} where - Existing where clause
 * @param {Date|string} fromDate - Start date
 * @param {Date|string} toDate - End date
 * @param {string} field - Date field name (default: 'createdAt')
 * @returns {Object} Updated where clause
 */
function addDateRangeFilter(where, fromDate, toDate, field = 'createdAt') {
  if (!fromDate && !toDate) return where;

  const dateFilter = {};
  
  if (fromDate) {
    dateFilter.gte = new Date(fromDate);
  }
  if (toDate) {
    dateFilter.lte = new Date(toDate);
  }

  return {
    ...where,
    [field]: dateFilter
  };
}

module.exports = {
  buildWhereClause,
  buildAdminWhereClause,
  canAccessBranch,
  requireBranchAccess,
  getPaginationParams,
  buildSortOrder,
  addDateRangeFilter,
  GLOBAL_ROLES
};
