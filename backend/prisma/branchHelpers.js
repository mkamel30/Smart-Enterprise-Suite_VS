/**
 * Programmatically adds branch filter to Prisma query args
 * 
 * âڑ ï¸ڈ CRITICAL WARNING: NEVER use this helper with unique operations!
 * 
 * â‌Œ DO NOT USE WITH:
 * - findUnique()
 * - findUniqueOrThrow()
 * - update() - when using unique where (id, serialNumber, etc.)
 * - delete() - when using unique where
 * - updateMany() - when using unique constraints
 * - deleteMany() - when using unique constraints
 * 
 * âœ… SAFE TO USE WITH:
 * - findMany()
 * - findFirst()
 * - count()
 * - aggregate()
 * - groupBy()
 * 
 * REASON: This helper wraps where in AND which breaks Prisma's unique input requirements.
 * 
 * Example of WRONG usage:
 * ```javascript
 * // â‌Œ BREAKS: Argument where of type NotificationWhereUniqueInput needs id
 * const notif = await db.notification.findUnique(
 *   ensureBranchWhere({ where: { id } }, req)
 * );
 * ```
 * 
 * Correct pattern for unique operations:
 * ```javascript
 * // âœ… CORRECT: Fetch by unique field, authorize in code
 * const notif = await db.notification.findUnique({ where: { id } });
 * if (!notif) throw new NotFoundError();
 * if (notif.branchId !== user.branchId && !isAdmin) {
 *   throw new ForbiddenError();
 * }
 * ```
 * 
 * @param {Object} args - Prisma query arguments
 * @param {Object} req - Express request object with user context
 * @returns {Object} Modified args with branch filter
 */
function ensureBranchWhere(args = {}, req) {
  if (!req || !req.user) return args;

  const userRole = req.user.role;
  const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CS_SUPERVISOR', 'CENTER_MANAGER'].includes(userRole);

  // Check for the special marker in the top-level or in args.where
  const hasMarker = args._skipBranchEnforcer === true || (args.where && args.where._skipBranchEnforcer === true);

  if (hasMarker) {
    // Strip the marker to avoid Prisma initialization errors
    if (args.where) delete args.where._skipBranchEnforcer;
    delete args._skipBranchEnforcer;

    // For admin/management roles, we truly skip. For others, we might still want the filter
    // but the marker shouldn't be what triggers it.
    if (['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role)) {
      return args;
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
    // No specific branch requested
    if (isAdmin && !userBranchId) {
      // Super admin without specific branch -> skip
      if (!args.where) return { ...args, where: { _skipBranchEnforcer: true } };
      return { ...args, where: { ...args.where, _skipBranchEnforcer: true } };
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
    return { ...args, where: { branchId: finalBranchFilter } };
  }

  const where = { ...args.where };
  if (typeof where === 'object' && !Object.prototype.hasOwnProperty.call(where, 'branchId')) {
    return { ...args, where: { AND: [{ branchId: finalBranchFilter }, where] } };
  }

  return args;
}

module.exports = { ensureBranchWhere };
