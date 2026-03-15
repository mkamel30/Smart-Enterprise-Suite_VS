const db = require('../../../../db');
const { createTransferOrder } = require('./orderService.js');

async function createBulkTransfer({ serialNumbers, toBranchId, fromBranchId: providedFromBranchId, waybillNumber, notes, performedBy }, user) {
    if (!serialNumbers?.length || !toBranchId) throw new Error('Serial numbers and destination branch are required');
    const fromBranchId = providedFromBranchId || user.branchId;
    if (!fromBranchId) throw new Error('Source branch is required');

    const machines = await db.warehouseMachine.findMany({ where: { serialNumber: { in: serialNumbers }, branchId: fromBranchId } });
    if (machines.length !== serialNumbers.length) throw new Error('Some machines not found in the source branch');

    return await createTransferOrder({
        fromBranchId, toBranchId, type: 'MACHINE', notes: notes || 'Bulk transfer',
        createdBy: user.id, createdByName: performedBy || user.displayName,
        items: machines.map(m => ({ serialNumber: m.serialNumber, model: m.model, manufacturer: m.manufacturer }))
    }, user);
}

async function importTransferFromExcel(buffer, { branchId, type, createdBy, createdByName, notes }, user) {
    const ExcelJS = require('exceljs');
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const worksheet = workbook.getWorksheet(1);
    const items = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const serialNumber = row.getCell(1).text;
        if (serialNumber) items.push({ serialNumber });
    });

    return await createTransferOrder({ fromBranchId: user.branchId, toBranchId: branchId, type, items, notes, createdBy, createdByName }, user);
}

module.exports = { createBulkTransfer, importTransferFromExcel };
