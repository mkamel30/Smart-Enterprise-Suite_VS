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
 * Example of WRONG usage:
 * ```javascript
 * // ❌ BREAKS: Argument where of type NotificationWhereUniqueInput needs id
 * const notif = await db.notification.findUnique(
 *   ensureBranchWhere({ where: { id } }, req)
 * );
 * ```
 * 
 * Correct pattern for unique operations:
 * ```javascript
 * // ✅ CORRECT: Fetch by unique field, authorize in code
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
  const branchId = req.user.branchId || req.body?.branchId || req.query?.branchId;
  if (!branchId) return args;

  // If no where provided, set simple branch filter
  if (!args.where) {
    return { ...args, where: { branchId } };
  }

  // If where exists but doesn't include branchId, wrap with AND
  if (typeof args.where === 'object' && !Object.prototype.hasOwnProperty.call(args.where, 'branchId')) {
    return { ...args, where: { AND: [{ branchId }, args.where] } };
  }

  return args;
}

module.exports = { ensureBranchWhere };
