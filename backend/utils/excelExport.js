/**
 * Excel Export Utilities
 * 
 * Standardizes Excel export logic across all route files to reduce
 * code duplication and ensure consistent export formatting.
 */

const { exportToExcel } = require('./excel');

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
  ]
};

/**
 * Transform customer data for export
 * @param {Array} customers - Array of customer objects from Prisma
 * @returns {Array} Transformed data for Excel export
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

/**
 * Transform request data for export
 * @param {Array} requests - Array of request objects from Prisma
 * @returns {Array} Transformed data for Excel export
 */
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

/**
 * Transform payment data for export
 * @param {Array} payments - Array of payment objects from Prisma
 * @returns {Array} Transformed data for Excel export
 */
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

/**
 * Transform transfer order data for export
 * @param {Array} orders - Array of transfer order objects
 * @returns {Array} Transformed data for Excel export
 */
function transformTransfersForExport(orders) {
  const statusMap = {
    'PENDING': 'معلق',
    'COMPLETED': 'مكتمل',
    'CANCELLED': 'ملغي',
    'APPROVED': 'معتمد',
    'REJECTED': 'مرفوض'
  };

  const typeMap = {
    'MACHINE': 'ماكينات',
    'SIM': 'شرائح',
    'SPARE_PART': 'قطع غيار'
  };

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

/**
 * Export entities to Excel with standardized formatting
 * @param {Array} data - Array of data objects
 * @param {string} entityType - Type of entity ('customers', 'requests', 'payments', 'transfers')
 * @param {string} filename - Base filename (without extension)
 * @returns {Promise<Buffer>} Excel file buffer
 */
async function exportEntitiesToExcel(data, entityType, filename) {
  const columns = EXPORT_COLUMNS[entityType];
  if (!columns) {
    throw new Error(`Unknown entity type: ${entityType}. Supported types: ${Object.keys(EXPORT_COLUMNS).join(', ')}`);
  }

  return await exportToExcel(data, columns, filename);
}

/**
 * Set Excel export headers on response
 * @param {Object} res - Express response object
 * @param {string} filename - Filename for download
 */
function setExcelHeaders(res, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=${filename}`);
}

/**
 * Generate timestamped filename for exports
 * @param {string} baseName - Base filename
 * @param {string} extension - File extension (default: xlsx)
 * @returns {string} Timestamped filename
 */
function generateExportFilename(baseName, extension = 'xlsx') {
  const timestamp = new Date().toISOString().slice(0, 10);
  return `${baseName}_${timestamp}.${extension}`;
}

module.exports = {
  EXPORT_COLUMNS,
  transformCustomersForExport,
  transformRequestsForExport,
  transformPaymentsForExport,
  transformTransfersForExport,
  exportEntitiesToExcel,
  setExcelHeaders,
  generateExportFilename,
  // Re-export from excel.js for convenience
  exportToExcel
};
