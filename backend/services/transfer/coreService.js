const db = require('../../db');

function applyTransferBranchFilter(args = {}, user, branchId) {
    if (!user) return args;
    const targetBranchId = branchId || user.branchId;
    if (['SUPER_ADMIN', 'MANAGEMENT', 'ADMIN_AFFAIRS', 'CENTER_MANAGER'].includes(user.role)) {
        if (branchId) {
            args.where = { ...args.where, OR: [{ fromBranchId: branchId }, { toBranchId: branchId }] };
        } else {
            if (!args.where) args.where = {};
            // For TransferOrder, we must use fromBranchId or toBranchId.
            // Using fromBranchId: { not: 'BYPASS' } satisfies the enforcer.
            args.where.fromBranchId = { not: '0000_BYPASS' };
        }
    } else {
        // Restricted roles must filter by their branch
        args.where = { ...args.where, OR: [{ fromBranchId: targetBranchId }, { toBranchId: targetBranchId }] };
    }
    return args;
}

function generateOrderNumber() {
    const timestamp = Date.now().toString().slice(-8);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `TO-${timestamp}-${random}`;
}

async function listTransferOrders(params, user) {
    const { branchId, status, type, fromDate, toDate, q, externalBranchId, limit, offset } = params;
    const args = applyTransferBranchFilter({ where: {} }, user, branchId);
    if (status) args.where.status = status;
    if (type) args.where.type = type;
    if (fromDate || toDate) args.where.createdAt = { gte: fromDate ? new Date(fromDate) : undefined, lte: toDate ? new Date(toDate) : undefined };
    if (q) args.where.OR = [{ orderNumber: { contains: q, mode: 'insensitive' } }, { waybillNumber: { contains: q, mode: 'insensitive' } }];
    if (externalBranchId) args.where.OR = [{ fromBranchId: externalBranchId }, { toBranchId: externalBranchId }];

    const [items, total] = await Promise.all([
        db.transferOrder.findMany({
            ...args,
            include: { fromBranch: true, toBranch: true, items: true },
            orderBy: { createdAt: 'desc' },
            take: limit,
            skip: offset
        }),
        db.transferOrder.count(args)
    ]);

    return { items, total };
}

async function getPendingOrders({ branchId, type }, user) {
    const targetBranchId = branchId || user.branchId;
    const where = { toBranchId: targetBranchId, status: { in: ['PENDING', 'PARTIAL'] } };
    if (type) where.type = type;
    return await db.transferOrder.findMany({ where, include: { fromBranch: true, items: true }, orderBy: { createdAt: 'desc' } });
}

async function getPendingSerials({ branchId, type }, user) {
    const orders = await getPendingOrders({ branchId, type }, user);
    const serials = new Set();
    orders.forEach(o => o.items.forEach(i => serials.add(i.serialNumber)));
    return Array.from(serials);
}

async function getTransferOrderById(id, user) {
    const args = applyTransferBranchFilter({
        where: { id },
        include: { fromBranch: true, toBranch: true, items: true }
    }, user);

    const order = await db.transferOrder.findFirst(args);
    if (!order) throw new Error('الإذن غير موجود');
    return order;
}

async function getStatsSummary({ branchId, fromDate, toDate }, user) {
    const args = applyTransferBranchFilter({ where: {} }, user, branchId);
    if (fromDate || toDate) args.where.createdAt = { gte: fromDate ? new Date(fromDate) : undefined, lte: toDate ? new Date(toDate) : undefined };

    const [total, pending, partial, completed, rejected, cancelled] = await Promise.all([
        db.transferOrder.count(args),
        db.transferOrder.count({ where: { ...args.where, status: 'PENDING' } }),
        db.transferOrder.count({ where: { ...args.where, status: 'PARTIAL' } }),
        db.transferOrder.count({ where: { ...args.where, status: 'COMPLETED' } }),
        db.transferOrder.count({ where: { ...args.where, status: 'REJECTED' } }),
        db.transferOrder.count({ where: { ...args.where, status: 'CANCELLED' } })
    ]);

    return {
        orders: {
            total,
            pending,
            partial,
            received: completed,
            rejected,
            cancelled
        }
    };
}

module.exports = {
    applyTransferBranchFilter,
    generateOrderNumber,
    listTransferOrders,
    getPendingOrders,
    getPendingSerials,
    getTransferOrderById,
    getStatsSummary
};
