/**
 * Programmatically adds branch filter to Prisma query args
 * 
 * ⚠️ CRITICAL WARNING: NEVER use this helper with unique operations!
 * 
 * ❌ DO NOT USE WITH:
 * - findUnique()
 * - findUniqueOrThrow()
 * - update() - when using unique where (id, serialNumber, etc.)
 * - delete() - when using unique where
 * - updateMany() - when using unique constraints
 * - deleteMany() - when using unique constraints
 * 
 * ✅ SAFE TO USE WITH:
 * - findMany()
 * - findFirst()
 * - count()
 * - aggregate()
 * - groupBy()
 * 
 * REASON: This helper wraps where in AND which breaks Prisma's unique input requirements.
 * 
 * @param {Object} args - Prisma query arguments
 * @param {Object} req - Express request object with user context
 * @param {Object} options - Optional configuration
 * @param {string} options.fieldName - Override default field name (default: 'branchId')
 * @returns {Object} Modified args with branch filter
 */
function ensureBranchWhere(args = {}, req, options = {}) {
  if (!req || !req.user) return args;

  const fieldName = options.fieldName || 'branchId';
  const userRole = req.user.role;
  const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CS_SUPERVISOR', 'CENTER_MANAGER'].includes(userRole);

  // Check for the special marker in query or where
  const hasMarker = args._skipBranchEnforcer === true || (args.where && args.where._skipBranchEnforcer === true);

  if (hasMarker) {
    if (args.where) delete args.where._skipBranchEnforcer;
    delete args._skipBranchEnforcer;

    // For Super Admins, if they want to skip branch enforcer, we provide a "Dummy" filter 
    // that satisfy the middleware check but returns everything.
    if (['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role)) {
      const dummyFilter = { not: 'SYSTEM_BYPASS_INTERNAL_ID' };
      return {
        ...args,
        where: {
          ...args.where,
          OR: [
            { [fieldName]: dummyFilter },
            { [fieldName]: null }
          ]
        }
      };
    }
  }
  // Resolve authorized branch IDs
  // 1. Get the base IDs the user is allowed to see (self + children, if loaded by middleware)
  const userBranchId = req.user.branchId;
  const authorizedIds = req.user.authorizedBranchIds || (userBranchId ? [userBranchId] : []);

  // 2. Resolve requested branchId from various sources
  const rawRequestedId = req.query?.branchId || req.body?.branchId;
  const requestedId = (rawRequestedId && rawRequestedId.trim() !== '') ? rawRequestedId : null;

  // 3. Logic:
  // - If requestedId exists:
  //    - If user is Admin (Super/Mgmt), allow requestedId.
  //    - If current user is restricted, allow requestedId ONLY if it's in authorizedIds.
  // - If NO requestedId exists:
  //    - If user is Admin (Super/Mgmt), skip filter (handled by _skipBranchEnforcer).
  //    - If current user is restricted, use authorizedIds (self + children).

  let finalBranchFilter;

  if (requestedId) {
    if (isAdmin || authorizedIds.includes(requestedId)) {
      finalBranchFilter = requestedId;
    } else {
      // Forbidden access attempt, force a filter that returns nothing
      finalBranchFilter = 'FORBIDDEN_ACCESS_' + Math.random();
    }
  } else {
    if (isAdmin && !userBranchId) {
      // Super admin without specific branch -> skip using dummy filter
      // Use OR with null only if the field is nullable, but enforcer just needs ANY branch field
      const dummyFilter = { OR: [{ [fieldName]: { not: 'BYPASS' } }, { [fieldName]: null }] };

      if (!args.where) return { ...args, where: dummyFilter };

      // Merge with existing where
      return {
        ...args,
        where: {
          AND: [
            dummyFilter,
            args.where
          ]
        }
      };
    }

    // Use the list of authorized branches
    if (authorizedIds.length > 0) {
      finalBranchFilter = authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds };
    } else {
      return args; // No branch restrictions found
    }
  }

  // Apply the filter
  if (!args.where) {
    return { ...args, where: { [fieldName]: finalBranchFilter } };
  }

  const where = { ...args.where };
  if (typeof where === 'object' && !Object.prototype.hasOwnProperty.call(where, fieldName)) {
    return { ...args, where: { AND: [{ [fieldName]: finalBranchFilter }, where] } };
  }

  return args;
}

module.exports = { ensureBranchWhere };
