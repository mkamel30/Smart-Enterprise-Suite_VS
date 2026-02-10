const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { z } = require('zod');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { getBranchFilter, canAccessBranch } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { logAction } = require('../utils/logger');
const { generateTemplate, parseExcelFile } = require('../utils/excel');
const { createPaginationResponse } = require('../utils/pagination');
const { exportEntitiesToExcel, transformCustomersForExport, setExcelHeaders, generateExportFilename } = require('../utils/excelExport');

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
  client_name: z.string().min(2, 'Name is required'),
  bkcode: z.string().min(1, 'Code is required'),
  phone: z.string().optional(),
  mobile: z.string().optional(),
  address: z.string().optional(),
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

// POST /import - Import customers from Excel file
router.post('/import', authenticateToken, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) {
    throw new AppError('No file uploaded', 400);
  }

  const branchId = req.user.branchId || req.body.branchId;
  if (!branchId) throw new AppError('Branch ID is required', 400);

  if (!await canAccessBranch(req, branchId, db)) {
    throw new AppError('Permission denied for this branch', 403);
  }

  // Parse the Excel file
  const rows = await parseExcelFile(req.file.buffer);

  if (rows.length === 0) {
    throw new AppError('No data found in file', 400);
  }

  const results = {
    imported: 0,
    skipped: 0,
    errors: []
  };

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    try {
      const bkcode = row['رقم العميل'] || row['كود العميل'] || row['bkcode'] || row['code'];
      const client_name = row['اسم العميل'] || row['client_name'] || row['name'];

      if (!bkcode || !client_name) {
        results.skipped++;
        results.errors.push({ row: bkcode || 'Unknown', error: 'Missing required fields' });
        continue;
      }

      const customerData = {
        client_name: String(client_name),
        address: row['العنوان'] || row['address'] || null,
        national_id: row['الرقم القومي'] || row['national_id'] || null,
        supply_office: row['مكتب التموين'] || row['supply_office'] || null,
        dept: row['إدارة التموين'] || row['dept'] || null,
        contact_person: row['الشخص المسؤول'] || row['contact_person'] || null,
        telephone_1: row['رقم الهاتف 1'] || row['telephone_1'] || row['phone'] || null,
        telephone_2: row['رقم الهاتف 2'] || row['telephone_2'] || row['mobile'] || null,
        clienttype: row['نوع العميل'] || row['clienttype'] || null
      };

      const existing = await db.customer.findFirst({
        where: { bkcode: String(bkcode), branchId }
      });

      if (existing) {
        await db.customer.updateMany({
          where: { id: existing.id, branchId },
          data: customerData
        });
        updated++;
        results.imported++;
      } else {
        await db.customer.create({
          data: {
            bkcode: String(bkcode),
            ...customerData,
            branchId
          }
        });
        created++;
        results.imported++;
      }
    } catch (error) {
      results.skipped++;
      results.errors.push({ row: row['رقم العميل'] || 'Unknown', error: error.message });
    }
  }

  await logAction({
    entityType: 'CUSTOMER',
    entityId: 'bulk-import',
    action: 'IMPORT',
    details: { imported: results.imported, skipped: results.skipped },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId
  });

  res.json({
    success: true,
    message: `تم استيراد ${results.imported} عميل بنجاح`,
    created,
    updated,
    ...results
  });
}));

// GET /export - Export customers to Excel
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
  const where = getBranchFilter(req);

  const customers = await db.customer.findMany(ensureBranchWhere({
    where,
    include: { branch: { select: { name: true } } },
    orderBy: { client_name: 'asc' }
  }, req));

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

  const customers = await db.customer.findMany(ensureBranchWhere({
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
  }, req));

  res.json(customers.map(c => ({
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
      { client_name: { contains: search } },
      { bkcode: { contains: search } },
      { phone: { contains: search } },
      { mobile: { contains: search } }
    ];
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany(ensureBranchWhere({
      where,
      include: {
        branch: { select: { name: true } },
        machines: true,
        simCards: true
      },
      orderBy: { client_name: 'asc' },
      take: limit,
      skip: offset
    }, req)),
    db.customer.count(ensureBranchWhere({ where }, req))
  ]);

  res.json(createPaginationResponse(customers.map(c => ({ ...c, posMachines: c.machines || [] })), total, limit || total, offset || 0));
}));

// GET /:id - Customer details
router.get('/:id', authenticateToken, asyncHandler(async (req, res) => {
  const customer = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id },
    include: {
      branch: { select: { name: true } },
      simCards: true,
      machines: true
    }
  }, req));

  if (!customer) throw new AppError('Customer not found', 404);

  res.json({ ...customer, posMachines: customer.machines || [] });
}));

// POST / - Create customer
router.post('/', authenticateToken, validateRequest(customerSchema), asyncHandler(async (req, res) => {
  const { client_name, bkcode, phone, mobile, address } = req.body;
  const branchId = req.user.branchId || req.body.branchId;

  if (!branchId) throw new AppError('Branch ID is required', 400);

  if (!await canAccessBranch(req, branchId, db)) {
    throw new AppError('Permission denied for this branch', 403);
  }

  const existing = await db.customer.findFirst({ where: { bkcode, branchId } });
  if (existing) throw new AppError('Customer code already exists in this branch', 409);

  const customer = await db.customer.create({
    data: {
      client_name,
      bkcode,
      phone: phone || null,
      mobile: mobile || null,
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

  res.status(201).json(customer);
}));

// PUT /:id - Update customer
router.put('/:id', authenticateToken, validateRequest(customerSchema.partial()), asyncHandler(async (req, res) => {
  const existing = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id }
  }, req));

  if (!existing) throw new AppError('Customer not found', 404);

  const updateData = { ...req.body };
  delete updateData.branchId; // Prevent moving customers between branches via normal update

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
    details: { changes: Object.keys(updateData) },
    userId: req.user.id,
    performedBy: req.user.displayName,
    branchId: customer.branchId
  });

  res.json(customer);
}));

// DELETE /:id - Delete customer
router.delete('/:id', authenticateToken, asyncHandler(async (req, res) => {
  if (!['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR'].includes(req.user.role)) {
    throw new AppError('Access denied', 403);
  }

  const existing = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id }
  }, req));

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

  res.json({ success: true });
}));

module.exports = router;
