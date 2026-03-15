const express = require('express');
const router = express.Router();
const db = require('../../../db');
const multer = require('multer');
const { authenticateToken } = require('../../../middleware/auth');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { ROLES } = require('../../../utils/constants');
const { asyncHandler, AppError } = require('../../../utils/errorHandler');
const { z } = require('zod');
const { validateRequest, validateQuery } = require('../../../middleware/validation');
const { getBranchFilter, canAccessBranch } = require('../../../middleware/permissions');
const { ensureBranchWhere } = require('../../../prisma/branchHelpers');
const { logAction } = require('../../../utils/logger');
const { generateTemplate, parseExcelFile } = require('../../../utils/excel');
const { exportEntitiesToExcel, transformCustomersForExport, setExcelHeaders, generateExportFilename } = require('../../../utils/excel');

// Multer configuration for Excel file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel') {
      cb(null, true);
    } else {
      cb(new Error('Only Excel files are allowed'), false);
    }
  }
});

// Validation Schemas
const customerSchema = z.object({
  client_name: z.string().min(2, 'Name is required').optional(),
  bkcode: z.string().min(1, 'Code is required').optional(),
  telephone_1: z.string().optional(),
  telephone_2: z.string().optional(),
  address: z.string().optional(),
  contact_person: z.string().optional(),
  national_id: z.string().optional(),
  supply_office: z.string().optional(),
  dept: z.string().optional(),
  notes: z.string().optional(),
  bk_type: z.string().optional(),
  clienttype: z.string().optional(),
  branchId: z.string().optional()
});

const listQuerySchema = z.object({
  search: z.string().optional(),
  limit: z.coerce.number().min(1).max(10000).optional(),
  offset: z.coerce.number().min(0).default(0)
});

// GET /template/download - Download Excel import template
router.get('/template/download', authenticateToken, asyncHandler(async (req, res) => {
  const columns = [
    { header: 'رقم العميل', key: 'bkcode', width: 15 },
    { header: 'اسم العميل', key: 'client_name', width: 30 },
    { header: 'العنوان', key: 'address', width: 40 },
    { header: 'الرقم القومي', key: 'national_id', width: 20 },
    { header: 'مكتب التموين', key: 'supply_office', width: 20 },
    { header: 'إدارة التموين', key: 'dept', width: 20 },
    { header: 'الشخص المسؤول', key: 'contact_person', width: 25 },
    { header: 'رقم الهاتف 1', key: 'telephone_1', width: 15 },
    { header: 'رقم الهاتف 2', key: 'telephone_2', width: 15 },
    { header: 'نوع العميل', key: 'clienttype', width: 15 }
  ];

  const buffer = await generateTemplate(columns, 'customers_import.xlsx');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', 'attachment; filename=customers_import.xlsx');
  res.send(buffer);
}));

const { importCustomers } = require('../shared/importExport.service');

// POST /import - Import customers from Excel file
router.post('/import', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError('No file uploaded', 400);

  const branchId = req.user.branchId || req.body.branchId;
  if (!branchId) throw new AppError('Branch ID is required', 400);

  if (!await canAccessBranch(req, branchId, db)) {
    throw new AppError('Permission denied for this branch', 403);
  }

  const results = await importCustomers(req.file.buffer, branchId, req.user);
  return success(res, {
    message: `تم استيراد ${results.imported} عميل بنجاح`,
    ...results
  });
}));

// GET /export - Export customers to Excel
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
  const where = getBranchFilter(req);

  const customers = await db.customer.findMany({
    where,
    include: { branch: { select: { name: true } } },
    orderBy: { client_name: 'asc' }
  });

  const data = transformCustomersForExport(customers);
  const buffer = await exportEntitiesToExcel(data, 'customers', 'customers_export');

  setExcelHeaders(res, generateExportFilename('customers_export'));
  res.send(buffer);
}));

// GET /lite - Dropdown list
router.get('/lite', authenticateToken, asyncHandler(async (req, res) => {
  const where = getBranchFilter(req);
  const search = req.query.search?.trim();

  if (search) {
    where.OR = [
      { client_name: { contains: search } },
      { bkcode: { startsWith: search } },
      { machines: { some: { serialNumber: { contains: search } } } }
    ];
  }

  const customers = await db.customer.findMany({
    where,
    select: {
      id: true,
      client_name: true,
      bkcode: true,
      branchId: true,
      machines: { select: { id: true, serialNumber: true, model: true } }
    },
    orderBy: { client_name: 'asc' },
    take: search ? 50 : 100
  });

  return success(res, customers.map(c => ({
    ...c,
    posMachines: c.machines || []
  })));
}));

// GET / - List all customers with pagination
router.get('/', authenticateToken, validateQuery(listQuerySchema), asyncHandler(async (req, res) => {
  const { search, limit, offset } = req.query;
  const where = getBranchFilter(req);

  if (search) {
    where.OR = [
      { client_name: { contains: search, mode: 'insensitive' } },
      { bkcode: { contains: search, mode: 'insensitive' } },
      { telephone_1: { contains: search, mode: 'insensitive' } },
      { telephone_2: { contains: search, mode: 'insensitive' } }
    ];
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany({
      where,
      include: {
        branch: { select: { name: true } },
        machines: true,
        simCards: true
      },
      orderBy: { client_name: 'asc' },
      take: limit,
      skip: offset
    }),
    db.customer.count({ where })
  ]);

  return paginated(res, customers.map(c => ({ ...c, posMachines: c.machines || [] })), total, limit || total, offset || 0);
}));

// GET /:id - Customer details
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const customer = await db.customer.findFirst({
    where: { id: req.params.id },
    include: {
      branch: { select: { name: true } },
      simCards: true,
      machines: true
    }
  });

  if (!customer) throw new AppError('Customer not found', 404);

  return success(res, { ...customer, posMachines: customer.machines || [] });
}));

// POST / - Create customer
router.post('/', authenticateToken, validateRequest(customerSchema), asyncHandler(async (req, res) => {
  const { client_name, bkcode, telephone_1, telephone_2, address } = req.body;
  const branchId = req.user.branchId || req.body.branchId;

  if (!branchId) throw new AppError('Branch ID is required', 400);

  if (!await canAccessBranch(req, branchId, db)) {
    throw new AppError('Permission denied for this branch', 403);
  }

  const existing = await db.customer.findFirst({ where: { bkcode } });
  if (existing) {
       if (existing.branchId === branchId) {
           throw new AppError('كود العميل موجود بالفعل في هذا الفرع', 409);
       } else {
           throw new AppError('كود العميل مستخدم بالفعل في فرع آخر ولا يمكن تكراره', 409);
       }
  }

  const customer = await db.customer.create({
    data: {
      client_name,
      bkcode,
      telephone_1: req.body.telephone_1 || req.body.phone || null,
      telephone_2: req.body.telephone_2 || req.body.mobile || null,
      address: address || null,
      branchId
    }
  });

  await logAction({
    entityType: 'CUSTOMER',
    entityId: customer.id,
    action: 'CREATE',
    details: { name: customer.client_name, code: customer.bkcode },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId
  });

  return success(res, customer, 201);
}));

// PUT /:id - Update customer (with detailed logging)
router.put('/:id', authenticateToken, validateRequest(customerSchema.partial()), asyncHandler(async (req, res) => {
  const existing = await db.customer.findFirst({
    where: { id: req.params.id }
  });

  if (!existing) throw new AppError('العميل غير موجود', 404);

  const updateData = { ...req.body };
  delete updateData.branchId; // Prevent moving customers between branches via normal update

  // Calculate detailed changes for logging
  const changes = {};
  const fieldTranslations = {
    'client_name': 'اسم العميل',
    'telephone_1': 'رقم التواصل 1',
    'telephone_2': 'رقم التواصل 2',
    'contact_person': 'الشخص المسؤول',
    'clienttype': 'تصنيف العميل',
    'bk_type': 'نوع النشاط',
    'address': 'العنوان',
    'national_id': 'الرقم القومي',
    'supply_office': 'مكتب التموين',
    'dept': 'القسم التابع له',
    'notes': 'الملاحظات'
  };

  Object.keys(updateData).forEach(key => {
    if (updateData[key] !== existing[key]) {
      changes[key] = {
        field: fieldTranslations[key] || key,
        oldValue: existing[key] || '-',
        newValue: updateData[key] || '-'
      };
    }
  });

  if (Object.keys(changes).length === 0) {
    return success(res, existing, 200, 'لا توجد تغييرات محددة');
  }

  await db.customer.updateMany({
    where: { id: req.params.id, branchId: existing.branchId },
    data: updateData
  });

  const customer = await db.customer.findFirst({
    where: { id: req.params.id, branchId: existing.branchId }
  });

  await logAction({
    entityType: 'CUSTOMER',
    entityId: customer.id,
    action: 'UPDATE',
    details: {
      name: customer.client_name,
      bkcode: customer.bkcode,
      changes
    },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId: customer.branchId
  });

  return success(res, customer, 200, 'تم تحديث بيانات العميل بنجاح');
}));

// DELETE /:id - Delete customer
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  if (![ROLES.SUPER_ADMIN, ROLES.MANAGEMENT, ROLES.BRANCH_MANAGER, ROLES.CS_SUPERVISOR].includes(req.user.role)) {
    throw new AppError('Access denied', 403);
  }

  const existing = await db.customer.findFirst({
    where: { id: req.params.id }
  });

  if (!existing) throw new AppError('Customer not found', 404);

  const hasData = await db.customer.findFirst({
    where: { id: req.params.id },
    include: { _count: { select: { machines: true, simCards: true } } }
  });

  if (hasData._count.machines > 0 || hasData._count.simCards > 0) {
    throw new AppError('Cannot delete customer with active devices', 400);
  }

  await db.customer.deleteMany({
    where: { id: req.params.id, branchId: existing.branchId }
  });

  await logAction({
    entityType: 'CUSTOMER',
    entityId: req.params.id,
    action: 'DELETE',
    details: { name: existing.client_name },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId: existing.branchId
  });

  return success(res, { success: true });
}));

module.exports = router;
