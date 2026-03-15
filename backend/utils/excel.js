const ExcelJS = require('exceljs');

/**
 * Excel Utilities
 * Centralized logic for Excel generation, parsing, and standardized exports.
 */

/**
 * Common column definitions for different entity types
 */
const EXPORT_COLUMNS = {
  customers: [
    { header: 'رقم العميل', key: 'bkcode', width: 15 },
    { header: 'اسم العميل', key: 'client_name', width: 30 },
    { header: 'العنوان', key: 'address', width: 40 },
    { header: 'الرقم القومي', key: 'national_id', width: 20 },
    { header: 'مكتب التموين', key: 'supply_office', width: 20 },
    { header: 'إدارة التموين', key: 'dept', width: 20 },
    { header: 'الشخص المسؤول', key: 'contact_person', width: 25 },
    { header: 'رقم الهاتف 1', key: 'telephone_1', width: 15 },
    { header: 'رقم الهاتف 2', key: 'telephone_2', width: 15 },
    { header: 'نوع العميل', key: 'clienttype', width: 15 },
    { header: 'الفرع', key: 'branchName', width: 20 }
  ],

  requests: [
    { header: 'التاريخ', key: 'date', width: 15 },
    { header: 'العميل', key: 'customer', width: 30 },
    { header: 'كود العميل', key: 'customerCode', width: 15 },
    { header: 'السيريال', key: 'serialNumber', width: 20 },
    { header: 'الموديل', key: 'model', width: 15 },
    { header: 'الشكوى', key: 'complaint', width: 40 },
    { header: 'الحالة', key: 'status', width: 15 },
    { header: 'الفني', key: 'technician', width: 20 },
    { header: 'الفرع', key: 'branch', width: 15 }
  ],

  payments: [
    { header: 'التاريخ', key: 'date', width: 15 },
    { header: 'العميل', key: 'customer', width: 25 },
    { header: 'كود العميل', key: 'customerCode', width: 15 },
    { header: 'المبلغ', key: 'amount', width: 12 },
    { header: 'السبب', key: 'reason', width: 20 },
    { header: 'رقم الإيصال', key: 'receiptNumber', width: 15 },
    { header: 'مكان الدفع', key: 'paymentPlace', width: 15 },
    { header: 'الموظف', key: 'user', width: 20 }
  ],

  transfers: [
    { header: 'التاريخ', key: 'date', width: 15 },
    { header: 'رقم الإذن', key: 'orderNumber', width: 15 },
    { header: 'النوع', key: 'type', width: 12 },
    { header: 'من الفرع', key: 'fromBranch', width: 20 },
    { header: 'إلى الفرع', key: 'toBranch', width: 20 },
    { header: 'عدد العناصر', key: 'itemCount', width: 12 },
    { header: 'الحالة', key: 'status', width: 12 },
    { header: 'ملاحظات', key: 'notes', width: 30 }
  ],

  machines: [
    { header: 'serialNumber', key: 'serialNumber', width: 25 },
    { header: 'model', key: 'model', width: 20 },
    { header: 'manufacturer', key: 'manufacturer', width: 20 },
    { header: 'customerId', key: 'customerId', width: 15 },
    { header: 'customerName', key: 'customerName', width: 30 },
    { header: 'posId', key: 'posId', width: 15 }
  ],

  sims: [
    { header: 'serialNumber', key: 'serialNumber', width: 25 },
    { header: 'type', key: 'type', width: 15 },
    { header: 'networkType', key: 'networkType', width: 15 },
    { header: 'customerId', key: 'customerId', width: 15 },
    { header: 'customerName', key: 'customerName', width: 30 }
  ],

  spareParts: [
    { header: 'رقم القطعة', key: 'partNumber', width: 15 },
    { header: 'الاسم', key: 'name', width: 30 },
    { header: 'الوصف', key: 'description', width: 30 },
    { header: 'الموديلات المتوافقة', key: 'compatibleModels', width: 25 },
    { header: 'التكلفة الافتراضية', key: 'defaultCost', width: 15 },
    { header: 'قابلة للاستهلاك', key: 'isConsumable', width: 10 },
    { header: 'متعددة', key: 'allowsMultiple', width: 12 },
    { header: 'الكمية الحالية', key: 'currentStock', width: 15 }
  ],

  users: [
    { header: 'الاسم', key: 'displayName', width: 25 },
    { header: 'البريد', key: 'email', width: 30 },
    { header: 'الدور', key: 'role', width: 20 },
    { header: 'الفرع', key: 'branchName', width: 20 },
    { header: 'فني', key: 'canDoMaintenance', width: 10 },
    { header: 'نشط', key: 'isActive', width: 10 }
  ]
};

/**
 * Generate Excel template with specified columns
 */
async function generateTemplate(columns, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('بيانات');

    worksheet.columns = columns;

    const header = worksheet.getRow(1);
    header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    header.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };

    return await workbook.xlsx.writeBuffer();
}

/**
 * Parse Excel file buffer into JSON
 */
async function parseExcelFile(buffer) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    const worksheet = workbook.worksheets[0];
    const rows = [];

    worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return; // Skip header

        const rowData = {};
        row.eachCell((cell, colNumber) => {
            const header = worksheet.getRow(1).getCell(colNumber).value;
            rowData[header] = cell.value;
        });

        if (Object.keys(rowData).length > 0) {
            rows.push(rowData);
        }
    });

    return rows;
}

/**
 * Export data array to Excel
 */
async function exportToExcel(data, columns, filename) {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('بيانات');

    worksheet.columns = columns;

    const header = worksheet.getRow(1);
    header.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    header.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
    };

    data.forEach(item => worksheet.addRow(item));

    // Auto-fit columns
    worksheet.columns.forEach(column => {
        let maxLength = 0;
        column.eachCell({ includeEmpty: true }, cell => {
            const cellLength = cell.value ? cell.value.toString().length : 10;
            if (cellLength > maxLength) maxLength = cellLength;
        });
        column.width = Math.min(maxLength + 2, 50);
    });

    return await workbook.xlsx.writeBuffer();
}

/**
 * Application specific transformations
 */
function transformCustomersForExport(customers) {
  return customers.map(c => ({
    bkcode: c.bkcode,
    client_name: c.client_name,
    address: c.address || '',
    national_id: c.national_id || '',
    supply_office: c.supply_office || '',
    dept: c.dept || '',
    contact_person: c.contact_person || '',
    telephone_1: c.telephone_1 || '',
    telephone_2: c.telephone_2 || '',
    clienttype: c.clienttype || '',
    branchName: c.branch?.name || ''
  }));
}

function transformRequestsForExport(requests) {
  return requests.map(r => ({
    date: new Date(r.createdAt).toLocaleString('ar-EG'),
    customer: r.customer?.client_name || r.customerName,
    customerCode: r.customer?.bkcode || '-',
    serialNumber: r.serialNumber,
    model: r.machineModel || r.posMachine?.model || '-',
    complaint: r.complaint,
    status: r.status,
    technician: r.technician || '-',
    branch: r.branch?.name || '-'
  }));
}

function transformPaymentsForExport(payments) {
  return payments.map(p => ({
    date: new Date(p.createdAt).toLocaleString('ar-EG'),
    customer: p.customerName || p.customer?.client_name || '-',
    customerCode: p.customer?.bkcode || '-',
    amount: p.amount || 0,
    reason: p.reason || '-',
    receiptNumber: p.receiptNumber || '-',
    paymentPlace: p.paymentPlace || '-',
    user: p.userName || '-'
  }));
}

function transformTransfersForExport(orders) {
  const statusMap = { 'PENDING': 'معلق', 'COMPLETED': 'مكتمل', 'CANCELLED': 'ملغي', 'APPROVED': 'معتمد', 'REJECTED': 'مرفوض' };
  const typeMap = { 'MACHINE': 'ماكينات', 'SIM': 'شرائح', 'SPARE_PART': 'قطع غيار' };

  return orders.map(o => ({
    date: new Date(o.createdAt).toLocaleString('ar-EG'),
    orderNumber: o.orderNumber || o.id.slice(0, 8),
    type: typeMap[o.type] || o.type,
    fromBranch: o.fromBranch?.name || '-',
    toBranch: o.toBranch?.name || '-',
    itemCount: o.items?.length || 0,
    status: statusMap[o.status] || o.status,
    notes: o.notes || '-'
  }));
}

function transformUsersForExport(users) {
  return users.map(u => ({
    displayName: u.displayName,
    email: u.email || '',
    role: u.role,
    branchName: u.branch?.name || '',
    canDoMaintenance: u.canDoMaintenance ? 'نعم' : 'لا',
    isActive: u.isActive ? 'نعم' : 'لا'
  }));
}

/**
 * Standardized entity export
 */
async function exportEntitiesToExcel(data, entityType, filename) {
  const columns = EXPORT_COLUMNS[entityType];
  if (!columns) throw new Error(`Unknown entity type: ${entityType}`);
  return await exportToExcel(data, columns, filename);
}

function setExcelHeaders(res, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
}

function generateExportFilename(baseName, extension = 'xlsx') {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${baseName}_${timestamp}.${extension}`;
}

module.exports = {
    EXPORT_COLUMNS,
    generateTemplate,
    parseExcelFile,
    exportToExcel,
    transformCustomersForExport,
    transformRequestsForExport,
    transformPaymentsForExport,
    transformTransfersForExport,
    transformUsersForExport,
    exportEntitiesToExcel,
    setExcelHeaders,
    generateExportFilename
};
