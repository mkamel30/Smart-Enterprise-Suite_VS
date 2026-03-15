/**
 * Transfer Validation Frontend Utilities (القانون الملزم)
 */

export const BRANCH_TYPES = {
    BRANCH: 'BRANCH',
    MAINTENANCE_CENTER: 'MAINTENANCE_CENTER',
    ADMIN_AFFAIRS: 'ADMIN_AFFAIRS',
    HQ: 'HQ'
};

/**
 * Filter branches that are legally allowed to receive a transfer from a source branch
 * Based on "The Binding Law" (القانون الملزم)
 */
export function getLegalTargetBranches(fromBranch: any, allBranches: any[], transferType?: string) {
    if (!fromBranch || !allBranches) return [];

    // Extract the effective from-branch details
    const fId = fromBranch.id;
    const fType = fromBranch.type;

    return allBranches.filter(toBranch => {
        // 0. MUST be active (Strict false check to avoid hiding branches if field is missing temporarily)
        if (toBranch.isActive === false) return false;

        // 0. Cannot transfer to the same branch (CRITICAL FIX)
        if (fId === toBranch.id) return false;

        const tType = toBranch.type;

        // 1. If sending from a regular BRANCH
        if (fType === BRANCH_TYPES.BRANCH) {
            // A. To ADMIN_AFFAIRS or HQ: Always allowed
            if (tType === BRANCH_TYPES.ADMIN_AFFAIRS || tType === BRANCH_TYPES.HQ) return true;

            // B. To MAINTENANCE_CENTER: Only if it's the assigned center
            if (tType === BRANCH_TYPES.MAINTENANCE_CENTER) {
                const isAssigned = fromBranch.maintenanceCenterId === toBranch.id;
                // If type is known, only machines. If not known, allow for selection as it might be machines.
                const isMachineType = !transferType || ['MACHINE', 'MAINTENANCE', 'SEND_TO_CENTER'].includes(transferType);
                return isAssigned && isMachineType;
            }

            // C. To another BRANCH: Only if Parent/Child relationship exists
            if (tType === BRANCH_TYPES.BRANCH) {
                const isParent = fId === toBranch.parentBranchId;
                const isChild = fromBranch.parentBranchId === toBranch.id;
                return isParent || isChild;
            }
        }

        // 2. If sending from ADMIN_AFFAIRS or HQ
        if (fType === BRANCH_TYPES.ADMIN_AFFAIRS || fType === BRANCH_TYPES.HQ) {
            // Can send to any other type (BRANCH, HQ, ADMIN_AFFAIRS, MAINTENANCE_CENTER)
            // But usually they target branches
            return true;
        }

        // 3. If sending from MAINTENANCE_CENTER
        if (fType === BRANCH_TYPES.MAINTENANCE_CENTER) {
            // Can send back to BRANCHES (usually ones they service)
            // Or to ADMIN_AFFAIRS to return parts/assets
            return tType !== BRANCH_TYPES.MAINTENANCE_CENTER;
        }

        return true;
    });
}

