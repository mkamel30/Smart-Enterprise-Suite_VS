const db = require('../db');

function normalizeSerial(serialNumber) {
    return String(serialNumber || '').trim();
}

async function getSerialConflicts(serialNumber) {
    const serial = normalizeSerial(serialNumber);
    if (!serial) return [];

    const [warehouse, pos] = await Promise.all([
        db.warehouseMachine.findMany({
            where: { serialNumber: serial },
            include: { branch: true }
        }),
        db.posMachine.findMany({
            where: { serialNumber: serial },
            include: { customer: { include: { branch: true } } }
        })
    ]);

    const conflicts = [];

    for (const m of warehouse) {
        conflicts.push({
            source: 'WAREHOUSE',
            serialNumber: serial,
            id: m.id,
            branchId: m.branchId,
            branchName: m.branch?.name || null,
            status: m.status || null,
            model: m.model || null,
            manufacturer: m.manufacturer || null
        });
    }

    for (const p of pos) {
        conflicts.push({
            source: 'CUSTOMER',
            serialNumber: serial,
            id: p.id,
            customerId: p.customerId,
            customerName: p.customer?.client_name || null,
            branchId: p.customer?.branchId || p.branchId || null,
            branchName: p.customer?.branch?.name || null,
            isMain: p.isMain || false
        });
    }

    return conflicts;
}

async function ensureSerialNotAssignedToCustomer(serialNumber) {
    const serial = normalizeSerial(serialNumber);
    if (!serial) {
        const err = new Error('Serial number is required');
        err.status = 400;
        throw err;
    }

    const existing = await db.posMachine.findUnique({
        where: { serialNumber: serial },
        include: { customer: { include: { branch: true } } }
    });

    if (existing) {
        const branchName = existing.customer?.branch?.name || existing.customer?.branchId || existing.branchId || 'غير محدد';
        const message = `الماكينة بالسيريال ${serial} مسجلة بالفعل لدى العميل ${existing.customer?.client_name || existing.customerId} في فرع ${branchName}`;
        const err = new Error(message);
        err.status = 400;
        err.code = 'SERIAL_IN_USE';
        err.conflict = {
            source: 'CUSTOMER',
            serialNumber: serial,
            customerId: existing.customerId,
            customerName: existing.customer?.client_name || null,
            branchId: existing.customer?.branchId || existing.branchId || null,
            branchName
        };
        throw err;
    }
}

module.exports = {
    getSerialConflicts,
    ensureSerialNotAssignedToCustomer,
    normalizeSerial
};
