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
  'Notification',
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
      const actionsToCheck = new Set(['findUnique', 'findFirst', 'findMany', 'update', 'updateMany', 'delete', 'deleteMany', 'count', 'aggregate', 'groupBy']);
      if (!actionsToCheck.has(params.action)) return next(params);

      const args = params.args || {};

      // Deeply strip _skipBranchEnforcer from query arguments in-place
      function stripBypass(obj) {
        if (!obj || typeof obj !== 'object') return obj;
        if (obj instanceof Date || obj instanceof Buffer) return obj;

        if (Array.isArray(obj)) {
          for (const item of obj) stripBypass(item);
          return obj;
        }

        // Remove the bypass flag if it exists
        if (Object.prototype.hasOwnProperty.call(obj, '_skipBranchEnforcer')) {
          delete obj._skipBranchEnforcer;
        }

        // Recursively clean all properties
        for (const key of Object.keys(obj)) {
          stripBypass(obj[key]);
        }
        return obj;
      }

      // Check for bypass BEFORE stripping
      const hasBypass = args._skipBranchEnforcer === true || (args.where && args.where._skipBranchEnforcer === true);

      // ALWAYS strip bypass flag from final arguments to prevent Prisma "Unknown argument" errors
      // We do this for ALL models to ensure no Prisma query is corrupted by the marker
      params.args = stripBypass(args);

      if (!models.has(params.model)) return next(params);

      if (hasBypass) {
        return next(params);
      }

      // If there is no `where` argument, block it
      if (!params.args.where) {
        const errorMsg = `Branch filter required: missing 'where' for ${params.model}.${params.action}`;
        console.error(`[BranchEnforcer] FAILED: ${errorMsg}`, { action: params.action, model: params.model });
        throw new Error(errorMsg);
      }

      if (!containsBranchId(params.args.where)) {
        const errorMsg = `Branch filter required: '${params.model}.${params.action}' must filter by branchId`;
        console.error(`[BranchEnforcer] FAILED: ${errorMsg}`, { action: params.action, model: params.model, where: JSON.stringify(params.args.where) });
        throw new Error(errorMsg);
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
