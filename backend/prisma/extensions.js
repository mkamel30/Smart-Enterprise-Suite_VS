const { Prisma } = require('@prisma/client');
const { getCurrentUser } = require('../utils/context');
const { isGlobalRole, ROLES } = require('../utils/constants');

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

/**
 * Map of models to their primary branch field names.
 * For complex models with multiple branch fields, we use an array.
 */
const modelBranchFields = {
    'BranchDebt': ['debtorBranchId', 'creditorBranchId'],
    'TransferOrder': ['fromBranchId', 'toBranchId'],
    'MaintenanceApprovalRequest': ['originBranchId', 'centerBranchId'],
    'ServiceAssignment': ['originBranchId', 'centerBranchId'],
    'MaintenanceRequest': ['branchId', 'servicedByBranchId'],
};

const getDefaultField = (model) => modelBranchFields[model] || ['branchId'];

/**
 * Prisma Extension for automatic branch filtering and auditing
 */
const securityExtension = Prisma.defineExtension((client) => {
    return client.$extends({
        query: {
            $allModels: {
                async $allOperations({ model, operation, args, query }) {
                    // 1. Strip _skipBranchEnforcer from ALL models to prevent Prisma errors
                    if (args._skipBranchEnforcer) delete args._skipBranchEnforcer;
                    if (args.where && args.where._skipBranchEnforcer) delete args.where._skipBranchEnforcer;

                    // 2. Skip if not a protected model
                    if (!model || !protectedModels.has(model)) {
                        return query(args);
                    }

                    // 2. Skip if not a read/write operation with 'where'
                    const actionsWithWhere = ['findFirst', 'findMany', 'count', 'aggregate', 'groupBy', 'updateMany', 'deleteMany'];
                    if (!actionsWithWhere.includes(operation)) {
                        return query(args);
                    }

                    // 3. Get current user from context
                    const user = getCurrentUser();
                    if (!user) {
                        // If no user context (e.g., background job), we might want to bypass or require a flag
                        if (args._skipBranchEnforcer) {
                            delete args._skipBranchEnforcer;
                            return query(args);
                        }
                        return query(args); // Or throw if we want strict security
                    }

                    // 4. Check for explicit bypass
                    if (args._skipBranchEnforcer || (args.where && args.where._skipBranchEnforcer)) {
                        if (args.where) delete args.where._skipBranchEnforcer;
                        delete args._skipBranchEnforcer;
                        return query(args);
                    }

                    // 5. Apply Branch Filtering
                    const isAdmin = isGlobalRole(user.role);
                    const fields = getDefaultField(model);
                    const userBranchId = user.branchId;
                    const authorizedIds = user.authorizedBranchIds || (userBranchId ? [userBranchId] : []);

                    // If user is Admin, they see all by default, but we provide a "bypass" filter 
                    // to satisfy the enforcer (though this extension IS the enforcer now)
                    if (isAdmin) {
                        // Admin doesn't need automatic filtering unless they provide one
                        return query(args);
                    }

                    // For restricted users, ensure they only see their authorized branches
                    if (authorizedIds.length > 0) {
                        const branchFilter = authorizedIds.length === 1 ? authorizedIds[0] : { in: authorizedIds };

                        // Construct the security filter
                        let securityWhere;
                        if (fields.length === 1) {
                            securityWhere = { [fields[0]]: branchFilter };
                        } else {
                            // For models with multiple branch fields, check if ANY match user's access
                            securityWhere = {
                                OR: fields.map(field => ({ [field]: branchFilter }))
                            };
                        }

                        // Merge with existing where
                        args.where = args.where ? { AND: [securityWhere, args.where] } : securityWhere;
                    }

                    return query(args);
                }
            }
        }
    });
});

module.exports = { securityExtension };
