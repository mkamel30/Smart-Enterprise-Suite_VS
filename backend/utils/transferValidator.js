/**
 * transferValidator.js
 * Implements the "Binding Law" (القانون الملزم) for all internal transfers.
 */

async function validateTransfer(tx, { fromBranchId, toBranchId, type, itemStatuses = [] }) {
    const fromBranch = await tx.branch.findUnique({ where: { id: fromBranchId } });
    const toBranch = await tx.branch.findUnique({ where: { id: toBranchId } });

    if (!fromBranch || !toBranch) {
        throw new Error('تعذر العثور على الفرع المرسل أو المستلم في النظام');
    }

    if (fromBranchId === toBranchId) {
        throw new Error('لا يمكن التحويل لنفس الموقع');
    }

    // --- Rule 1: Branches to Admin Affairs ---
    if (fromBranch.type === 'BRANCH' && toBranch.type === 'ADMIN_AFFAIRS') {
        // Can only transfer Machines and SIM cards
        if (!['MACHINE', 'SIM_CARD', 'ASSET'].includes(type)) {
            throw new Error('الفروع يمكنها تحويل الماكينات وشرائح البيانات فقط للشئون الإدارية');
        }
    }

    // --- Rule 2: Admin Affairs to Branches ---
    if (fromBranch.type === 'ADMIN_AFFAIRS' && toBranch.type === 'BRANCH') {
        // Full permission: Can transfer any item type
    }

    // --- Rule 3: Branches to Maintenance Center ---
    if (fromBranch.type === 'BRANCH' && toBranch.type === 'MAINTENANCE_CENTER') {
        // Must be the assigned maintenance center
        if (fromBranch.maintenanceCenterId !== toBranch.id) {
            throw new Error('لا يمكن التحويل إلا لمركز الصيانة التابع له الفرع');
        }

        // Only Machines allowed
        if (type !== 'MACHINE') {
            throw new Error('مراكز الصيانة تستقبل الماكينات فقط لإجراء العمرات والإصلاحات');
        }

        // Must be non-new machines (Used/Faulty)
        // If status check is possible:
        if (itemStatuses.includes('NEW')) {
            throw new Error('لا يمكن تحويل ماكينات جديدة كلياً لمركز الصيانة؛ العمرات تتم للماكينات القديمة');
        }
    }

    // --- Rule 4: Branch-to-Branch Transfers ---
    if (fromBranch.type === 'BRANCH' && toBranch.type === 'BRANCH') {
        const isParent = fromBranch.id === toBranch.parentBranchId;
        const isChild = fromBranch.parentBranchId === toBranch.id;

        if (!isParent && !isChild) {
            throw new Error('التحويل المباشر بين الفروع مسموح فقط في حالة وجود علاقة تبعية (فرع رئيسي وفرع تابع)');
        }
        // Full permission for items/parts within hierarchy
    }

    return true;
}

module.exports = { validateTransfer };
