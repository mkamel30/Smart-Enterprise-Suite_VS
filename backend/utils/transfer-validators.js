/**
 * Transfer Order Validation Utilities
 * ظ…ط¬ظ…ظˆط¹ط© ظ…ظ† ط§ظ„ظ€ validators ظ„ظ„طھط£ظƒط¯ ظ…ظ† طµط­ط© ط¹ظ…ظ„ظٹط§طھ ط§ظ„طھط­ظˆظٹظ„
 */

const db = require('../db');

/**
 * Validate that machines/sims are available for transfer
 * ط§ظ„طھط­ظ‚ظ‚ ظ…ظ† ط£ظ† ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ/ط§ظ„ط´ط±ط§ط¦ط­ ظ…طھط§ط­ط© ظ„ظ„طھط­ظˆظٹظ„
 * 
 * @param {string[]} serialNumbers - Array of serial numbers to validate
 * @param {string} type - Transfer type (MACHINE, SIM, MAINTENANCE)
 * @param {string} fromBranchId - Source branch ID
 * @returns {Promise<{valid: boolean, errors: string[], warnings: string[]}>}
 */
async function validateItemsForTransfer(serialNumbers, type, fromBranchId) {
    const errors = [];
    const warnings = [];

    if (!serialNumbers || serialNumbers.length === 0) {
        errors.push('ظ„ط§ طھظˆط¬ط¯ ط£طµظ†ط§ظپ ظ„ظ„طھط­ظˆظٹظ„');
        return { valid: false, errors, warnings };
    }

    if (!fromBranchId) {
        errors.push('ظپط±ط¹ ط§ظ„ظ…طµط¯ط± ظ…ط·ظ„ظˆط¨');
        return { valid: false, errors, warnings };
    }

    // Check for items already in pending transfers (from ANY branch)
    const existingPendingTransfers = await db.transferOrderItem.findMany({
        where: {
            serialNumber: { in: serialNumbers },
            transferOrder: { 
                status: { in: ['PENDING', 'PARTIAL'] }
            }
        },
        include: {
            transferOrder: {
                include: {
                    fromBranch: true,
                    toBranch: true
                }
            }
        }
    });

    if (existingPendingTransfers.length > 0) {
        const pendingDetails = existingPendingTransfers.map(item => {
            const order = item.transferOrder;
            return `${item.serialNumber} (ط¥ط°ظ† ${order.orderNumber} ظ…ظ† ${order.fromBranch.name} ط¥ظ„ظ‰ ${order.toBranch.name})`;
        });
        errors.push(`ط§ظ„ط£طµظ†ط§ظپ ط§ظ„طھط§ظ„ظٹط© ظ…ظˆط¬ظˆط¯ط© ظپظٹ طھط­ظˆظٹظ„ط§طھ ظ…ط¹ظ„ظ‚ط©:\n${pendingDetails.join('\n')}`);
    }

    if (type === 'MACHINE' || type === 'MAINTENANCE' || type === 'SEND_TO_CENTER') {
        // Validate machines
        const machines = await db.warehouseMachine.findMany({
            where: {
                serialNumber: { in: serialNumbers }
            },
            include: {
                branch: true
            }
        });

        const foundSerials = new Set(machines.map(m => m.serialNumber));
        const missingSerials = serialNumbers.filter(s => !foundSerials.has(s));

        // Check for machines not found in warehouse
        if (missingSerials.length > 0) {
            errors.push(`ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط§ظ„طھط§ظ„ظٹط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط§ظ„ظ…ط®ط²ظ†:\n${missingSerials.join(', ')}`);
        }

        // Check for machines not in source branch
        const wrongBranchMachines = machines.filter(m => m.branchId !== fromBranchId);
        if (wrongBranchMachines.length > 0) {
            const details = wrongBranchMachines.map(m => 
                `${m.serialNumber} (ظ…ظˆط¬ظˆط¯ ظپظٹ ${m.branch?.name || 'ظپط±ط¹ ط¢ط®ط±'})`
            );
            errors.push(`ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط§ظ„طھط§ظ„ظٹط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط§ظ„ظپط±ط¹ ط§ظ„ظ…ط±ط³ظ„:\n${details.join('\n')}`);
        }

        // Check for machines already in transit or locked
        const invalidStatusMachines = machines.filter(m => {
            const lockedStatuses = ['IN_TRANSIT', 'SOLD', 'ASSIGNED', 'UNDER_MAINTENANCE'];
            return lockedStatuses.includes(m.status);
        });

        if (invalidStatusMachines.length > 0) {
            const details = invalidStatusMachines.map(m => 
                `${m.serialNumber} (ط§ظ„ط­ط§ظ„ط©: ${getStatusArabic(m.status)})`
            );
            errors.push(`ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط§ظ„طھط§ظ„ظٹط© ط؛ظٹط± ظ…طھط§ط­ط© ظ„ظ„طھط­ظˆظٹظ„:\n${details.join('\n')}`);
        }

        // Warnings for machines with active maintenance requests
        const activeMaintenance = await db.maintenanceRequest.findMany({
            where: {
                serialNumber: { in: serialNumbers },
                status: { notIn: ['Closed', 'Cancelled', 'PENDING_TRANSFER'] },
                branchId: fromBranchId
            }
        });

        if (activeMaintenance.length > 0 && type !== 'MAINTENANCE') {
            const details = activeMaintenance.map(r => 
                `${r.serialNumber} (ط·ظ„ط¨ طµظٹط§ظ†ط© ${r.status})`
            );
            warnings.push(`طھظ†ط¨ظٹظ‡: ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط§ظ„طھط§ظ„ظٹط© ط¹ظ„ظٹظ‡ط§ ط·ظ„ط¨ط§طھ طµظٹط§ظ†ط© ظ†ط´ط·ط©:\n${details.join('\n')}`);
        }

    } else if (type === 'SIM') {
        // Validate SIMs
        const sims = await db.warehouseSim.findMany({
            where: {
                serialNumber: { in: serialNumbers }
            },
            include: {
                branch: true
            }
        });

        const foundSerials = new Set(sims.map(s => s.serialNumber));
        const missingSerials = serialNumbers.filter(s => !foundSerials.has(s));

        if (missingSerials.length > 0) {
            errors.push(`ط§ظ„ط´ط±ط§ط¦ط­ ط§ظ„طھط§ظ„ظٹط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط§ظ„ظ…ط®ط²ظ†:\n${missingSerials.join(', ')}`);
        }

        const wrongBranchSims = sims.filter(s => s.branchId !== fromBranchId);
        if (wrongBranchSims.length > 0) {
            const details = wrongBranchSims.map(s => 
                `${s.serialNumber} (ظ…ظˆط¬ظˆط¯ ظپظٹ ${s.branch?.name || 'ظپط±ط¹ ط¢ط®ط±'})`
            );
            errors.push(`ط§ظ„ط´ط±ط§ط¦ط­ ط§ظ„طھط§ظ„ظٹط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯ط© ظپظٹ ط§ظ„ظپط±ط¹ ط§ظ„ظ…ط±ط³ظ„:\n${details.join('\n')}`);
        }

        const invalidStatusSims = sims.filter(s => s.status === 'IN_TRANSIT' || s.status === 'SOLD');
        if (invalidStatusSims.length > 0) {
            const details = invalidStatusSims.map(s => 
                `${s.serialNumber} (ط§ظ„ط­ط§ظ„ط©: ${getStatusArabic(s.status)})`
            );
            errors.push(`ط§ظ„ط´ط±ط§ط¦ط­ ط§ظ„طھط§ظ„ظٹط© ط؛ظٹط± ظ…طھط§ط­ط© ظ„ظ„طھط­ظˆظٹظ„:\n${details.join('\n')}`);
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings
    };
}

/**
 * Get Arabic translation for status
 */
function getStatusArabic(status) {
    const statusMap = {
        'IN_TRANSIT': 'ظ‚ظٹط¯ ط§ظ„ظ†ظ‚ظ„',
        'SOLD': 'ظ…ط¨ط§ط¹ط©',
        'ASSIGNED': 'ظ…ط¹ظٹظ†ط©',
        'UNDER_MAINTENANCE': 'طھط­طھ ط§ظ„طµظٹط§ظ†ط©',
        'NEW': 'ط¬ط¯ظٹط¯ط©',
        'STANDBY': 'ط¬ط§ظ‡ط²ط©',
        'RECEIVED_AT_CENTER': 'ظ…ط³طھظ„ظ…ط© ط¨ط§ظ„ظ…ط±ظƒط²',
        'PENDING_APPROVAL': 'ط¨ط§ظ†طھط¸ط§ط± ط§ظ„ظ…ظˆط§ظپظ‚ط©',
        'APPROVED': 'ظ…ظˆط§ظپظ‚ ط¹ظ„ظٹظ‡ط§',
        'REJECTED': 'ظ…ط±ظپظˆط¶ط©',
        'COMPLETED': 'ظ…ظƒطھظ…ظ„ط©'
    };
    return statusMap[status] || status;
}

/**
 * Validate branches are valid and accessible
 */
async function validateBranches(fromBranchId, toBranchId, type) {
    const errors = [];

    if (!fromBranchId || !toBranchId) {
        errors.push('ظپط±ط¹ ط§ظ„ظ…طµط¯ط± ظˆط§ظ„ظˆط¬ظ‡ط© ظ…ط·ظ„ظˆط¨ط§ظ†');
        return { valid: false, errors };
    }

    if (fromBranchId === toBranchId) {
        errors.push('ظ„ط§ ظٹظ…ظƒظ† ط§ظ„طھط­ظˆظٹظ„ ظ„ظ†ظپط³ ط§ظ„ظپط±ط¹');
        return { valid: false, errors };
    }

    const [fromBranch, toBranch] = await Promise.all([
        db.branch.findUnique({ where: { id: fromBranchId } }),
        db.branch.findUnique({ where: { id: toBranchId } })
    ]);

    if (!fromBranch) {
        errors.push('ظپط±ط¹ ط§ظ„ظ…طµط¯ط± ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
    } else if (!fromBranch.isActive) {
        errors.push('ظپط±ط¹ ط§ظ„ظ…طµط¯ط± ط؛ظٹط± ظ†ط´ط·');
    }

    if (!toBranch) {
        errors.push('ظپط±ط¹ ط§ظ„ظˆط¬ظ‡ط© ط؛ظٹط± ظ…ظˆط¬ظˆط¯');
    } else if (!toBranch.isActive) {
        errors.push('ظپط±ط¹ ط§ظ„ظˆط¬ظ‡ط© ط؛ظٹط± ظ†ط´ط·');
    }

    // Validate type-specific branch requirements
    if (type === 'MAINTENANCE' || type === 'SEND_TO_CENTER') {
        if (toBranch && toBranch.type !== 'MAINTENANCE_CENTER') {
            errors.push('ط§ظ„طھط­ظˆظٹظ„ ظ„ظ„طµظٹط§ظ†ط© ظٹط¬ط¨ ط£ظ† ظٹظƒظˆظ† ظ„ظ…ط±ظƒط² طµظٹط§ظ†ط©');
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        fromBranch,
        toBranch
    };
}

/**
 * Check if user has permission to create transfer from specified branch
 */
function validateUserPermission(user, fromBranchId) {
    const errors = [];

    if (!user) {
        errors.push('ط§ظ„ظ…ط³طھط®ط¯ظ… ط؛ظٹط± ظ…طµط±ط­');
        return { valid: false, errors };
    }

    const isGlobalAdmin = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS'].includes(user.role);
    
    // Global admins can transfer from any branch
    if (isGlobalAdmin) {
        return { valid: true, errors };
    }

    // Regular users can only transfer from their own branch
    if (user.branchId !== fromBranchId) {
        errors.push('ظ„ظٹط³ ظ„ط¯ظٹظƒ طµظ„ط§ط­ظٹط© ط§ظ„طھط­ظˆظٹظ„ ظ…ظ† ظ‡ط°ط§ ط§ظ„ظپط±ط¹');
        return { valid: false, errors };
    }

    return { valid: true, errors };
}

/**
 * Comprehensive validation before creating transfer
 */
async function validateTransferOrder(data, user) {
    const { fromBranchId, toBranchId, type, items } = data;
    const allErrors = [];
    const allWarnings = [];

    // Validate user permission
    const permissionCheck = validateUserPermission(user, fromBranchId);
    if (!permissionCheck.valid) {
        allErrors.push(...permissionCheck.errors);
    }

    // Validate branches
    const branchCheck = await validateBranches(fromBranchId, toBranchId, type);
    if (!branchCheck.valid) {
        allErrors.push(...branchCheck.errors);
    }

    // If critical errors, stop here
    if (allErrors.length > 0) {
        return { valid: false, errors: allErrors, warnings: allWarnings };
    }

    // Validate items
    const serialNumbers = items.map(i => i.serialNumber).filter(s => s);
    const itemsCheck = await validateItemsForTransfer(serialNumbers, type, fromBranchId);
    
    allErrors.push(...itemsCheck.errors);
    allWarnings.push(...itemsCheck.warnings);

    return {
        valid: allErrors.length === 0,
        errors: allErrors,
        warnings: allWarnings
    };
}

module.exports = {
    validateItemsForTransfer,
    validateBranches,
    validateUserPermission,
    validateTransferOrder,
    getStatusArabic
};
