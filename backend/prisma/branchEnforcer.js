// Prisma middleware to require branchId filtering on sensitive models
// This middleware throws if a query on a protected model does not include any branchId filter.
// NOTE: User model is NOT protected here because admin users (SUPER_ADMIN, MANAGEMENT) have null branchId.
// User access control is enforced via requireAdmin/requireSuperAdmin middleware instead.
const protectedModels = new Set([
  'Customer',
  'MachineSale',
  'Installment',
  'MaintenanceRequest',
  'WarehouseMachine',
  'WarehouseSim',
  'PosMachine',
  'SimCard',
  'InventoryItem',
  'StockMovement',
  'Payment',
  'BranchDebt',
  'TransferOrder',
  'MaintenanceApproval',
  'MaintenanceApprovalRequest',
  'ServiceAssignment',
  'UsedPartLog',
  'MachineMovementLog',
  'SimMovementLog',
  'SystemLog',
  'RepairVoucher',
]);

const branchFieldNames = [
  'branchId',
  'originBranchId',
  'centerBranchId',
  'fromBranchId',
  'toBranchId',
  'debtorBranchId',
  'creditorBranchId',
  'servicedByBranchId',
];

function containsBranchId(obj) {
  if (!obj || typeof obj !== 'object') return false;

  if (branchFieldNames.some(field => Object.prototype.hasOwnProperty.call(obj, field))) {
    return true;
  }
  // traverse logical operators
  const keys = Object.keys(obj);
  for (const k of keys) {
    const v = obj[k];
    if (Array.isArray(v)) {
      for (const item of v) if (containsBranchId(item)) return true;
    } else if (typeof v === 'object') {
      if (containsBranchId(v)) return true;
    }
  }
  return false;
}

function attachBranchEnforcer(prisma, opts = {}) {
  const models = opts.models || protectedModels;

  prisma.$use(async (params, next) => {
    try {
      // Only enforce on certain actions that accept `where`
      const actionsToCheck = new Set(['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate']);
      if (!actionsToCheck.has(params.action)) return next(params);

      const args = params.args || {};

      if (!models.has(params.model)) return next(params);

      // Special marker: if query has _skipBranchEnforcer = true, skip the check
      // This is set by ensureBranchWhere for admin users viewing all branches
      if (args.where && args.where._skipBranchEnforcer === true) {
        // Remove the marker before sending to Prisma
        const { _skipBranchEnforcer, ...cleanWhere } = args.where;
        params.args = { ...args, where: Object.keys(cleanWhere).length > 0 ? cleanWhere : undefined };
        // If where is now empty, remove it entirely for findMany/aggregate
        if (!params.args.where || Object.keys(params.args.where).length === 0) {
          delete params.args.where;
        }
        return next(params);
      }

      // If there is no `where` argument, block it
      if (!args.where) {
        throw new Error(`Branch filter required: missing 'where' for ${params.model}.${params.action}`);
      }

      if (!containsBranchId(args.where)) {
        throw new Error(`Branch filter required: '${params.model}.${params.action}' must filter by branchId`);
      }

      return next(params);
    } catch (err) {
      // Surface a helpful error so failures are easy to find during CI/dev
      throw err;
    }
  });
}

module.exports = {
  attachBranchEnforcer,
  protectedModels,
};
