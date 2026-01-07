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
  const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(userRole);

  // Resolve branchId from various sources
  const branchId = req.user.branchId || req.body?.branchId || req.query?.branchId;

  // If no branchId is found and user is Admin, we still include the key to satisfy the enforcer
  if (!branchId && isAdmin) {
    if (!args.where) {
      return { ...args, where: { branchId: { not: null } } };
    }
    const where = { ...args.where, branchId: { not: null } };
    return { ...args, where };
  }

  // If still no branchId and NOT admin, we might still return as is 
  // and let the enforcer catch it, or we could force a filter that returns nothing.
  if (!branchId) return args;

  // If no where provided, set simple branch filter
  if (!args.where) {
    return { ...args, where: { branchId } };
  }

  // If where exists but doesn't include branchId, wrap with AND
  // (We check for branchId at top level of where)
  const where = { ...args.where };
  if (typeof where === 'object' && !Object.prototype.hasOwnProperty.call(where, 'branchId')) {
    return { ...args, where: { AND: [{ branchId }, where] } };
  }

  return args;
}

module.exports = { ensureBranchWhere };
