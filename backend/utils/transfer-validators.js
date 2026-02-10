/**
 * Transfer Order Validation Utilities
 * مجموعة من الـ validators للتأكد من صحة عمليات التحويل
 */

const db = require('../db');

/**
 * Validate that machines/sims are available for transfer
 * التحقق من أن الماكينات/الشرائح متاحة للتحويل
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
        errors.push('لا توجد أصناف للتحويل');
        return { valid: false, errors, warnings };
    }

    if (!fromBranchId) {
        errors.push('فرع المصدر مطلوب');
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
            return `${item.serialNumber} (إذن ${order.orderNumber} من ${order.fromBranch.name} إلى ${order.toBranch.name})`;
        });
        errors.push(`الأصناف التالية موجودة في تحويلات معلقة:\n${pendingDetails.join('\n')}`);
    }

    if (type === 'MACHINE' || type === 'MAINTENANCE' || type === 'SEND_TO_CENTER') {
        // Validate machines
        const machines = await db.warehouseMachine.findMany({
            where: {
                serialNumber: { in: serialNumbers },
                branchId: fromBranchId
            },
            include: {
                branch: true
            }
        });

        const foundSerials = new Set(machines.map(m => m.serialNumber));
        const missingSerials = serialNumbers.filter(s => !foundSerials.has(s));

        // Check for machines not found in warehouse
        if (missingSerials.length > 0) {
            errors.push(`الماكينات التالية غير موجودة في المخزن:\n${missingSerials.join(', ')}`);
        }

        // Check for machines not in source branch
        const wrongBranchMachines = machines.filter(m => m.branchId !== fromBranchId);
        if (wrongBranchMachines.length > 0) {
            const details = wrongBranchMachines.map(m =>
                `${m.serialNumber} (موجود في ${m.branch?.name || 'فرع آخر'})`
            );
            errors.push(`الماكينات التالية غير موجودة في الفرع المرسل:\n${details.join('\n')}`);
        }

        // Check for machines already in transit or locked
        const invalidStatusMachines = machines.filter(m => {
            const lockedStatuses = ['IN_TRANSIT', 'SOLD', 'ASSIGNED', 'UNDER_MAINTENANCE'];
            return lockedStatuses.includes(m.status);
        });

        if (invalidStatusMachines.length > 0) {
            const details = invalidStatusMachines.map(m =>
                `${m.serialNumber} (الحالة: ${getStatusArabic(m.status)})`
            );
            errors.push(`الماكينات التالية غير متاحة للتحويل:\n${details.join('\n')}`);
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
                `${r.serialNumber} (طلب صيانة ${r.status})`
            );
            warnings.push(`تنبيه: الماكينات التالية عليها طلبات صيانة نشطة:\n${details.join('\n')}`);
        }

    } else if (type === 'SIM') {
        // Validate SIMs
        const sims = await db.warehouseSim.findMany({
            where: {
                serialNumber: { in: serialNumbers },
                branchId: fromBranchId
            },
            include: {
                branch: true
            }
        });

        const foundSerials = new Set(sims.map(s => s.serialNumber));
        const missingSerials = serialNumbers.filter(s => !foundSerials.has(s));

        if (missingSerials.length > 0) {
            errors.push(`الشرائح التالية غير موجودة في المخزن:\n${missingSerials.join(', ')}`);
        }

        const wrongBranchSims = sims.filter(s => s.branchId !== fromBranchId);
        if (wrongBranchSims.length > 0) {
            const details = wrongBranchSims.map(s =>
                `${s.serialNumber} (موجود في ${s.branch?.name || 'فرع آخر'})`
            );
            errors.push(`الشرائح التالية غير موجودة في الفرع المرسل:\n${details.join('\n')}`);
        }

        const invalidStatusSims = sims.filter(s => s.status === 'IN_TRANSIT' || s.status === 'SOLD');
        if (invalidStatusSims.length > 0) {
            const details = invalidStatusSims.map(s =>
                `${s.serialNumber} (الحالة: ${getStatusArabic(s.status)})`
            );
            errors.push(`الشرائح التالية غير متاحة للتحويل:\n${details.join('\n')}`);
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
        'IN_TRANSIT': 'قيد النقل',
        'SOLD': 'مباعة',
        'ASSIGNED': 'معينة',
        'UNDER_MAINTENANCE': 'تحت الصيانة',
        'NEW': 'جديدة',
        'STANDBY': 'جاهزة',
        'RECEIVED_AT_CENTER': 'مستلمة بالمركز',
        'PENDING_APPROVAL': 'بانتظار الموافقة',
        'APPROVED': 'موافق عليها',
        'REJECTED': 'مرفوضة',
        'COMPLETED': 'مكتملة'
    };
    return statusMap[status] || status;
}

/**
 * Validate branches are valid and accessible
 */
async function validateBranches(fromBranchId, toBranchId, type) {
    const errors = [];

    if (!fromBranchId || !toBranchId) {
        errors.push('فرع المصدر والوجهة مطلوبان');
        return { valid: false, errors };
    }

    if (fromBranchId === toBranchId) {
        errors.push('لا يمكن التحويل لنفس الفرع');
        return { valid: false, errors };
    }

    const [fromBranch, toBranch] = await Promise.all([
        db.branch.findUnique({ where: { id: fromBranchId } }),
        db.branch.findUnique({ where: { id: toBranchId } })
    ]);

    if (!fromBranch) {
        errors.push('فرع المصدر غير موجود');
    } else if (!fromBranch.isActive) {
        errors.push('فرع المصدر غير نشط');
    }

    if (!toBranch) {
        errors.push('فرع الوجهة غير موجود');
    } else if (!toBranch.isActive) {
        errors.push('فرع الوجهة غير نشط');
    }

    // Validate type-specific branch requirements
    if (type === 'MAINTENANCE' || type === 'SEND_TO_CENTER') {
        if (toBranch && toBranch.type !== 'MAINTENANCE_CENTER') {
            errors.push('التحويل للصيانة يجب أن يكون لمركز صيانة');
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
        errors.push('المستخدم غير مصرح');
        return { valid: false, errors };
    }

    const isGlobalAdmin = ['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS'].includes(user.role);

    // Global admins can transfer from any branch
    if (isGlobalAdmin) {
        return { valid: true, errors };
    }

    // Support hierarchy: Users can transfer from their own branch OR any child branch
    const authorizedIds = user.authorizedBranchIds || (user.branchId ? [user.branchId] : []);

    if (!authorizedIds.includes(fromBranchId)) {
        errors.push('ليس لديك صلاحية التحويل من هذا الفرع أو الفروع التابعة له');
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
