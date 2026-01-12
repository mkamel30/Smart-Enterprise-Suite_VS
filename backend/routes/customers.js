const express = require('express');
const router = express.Router();
const db = require('../db');
const multer = require('multer');
const { authenticateToken } = require('../middleware/auth');
const { asyncHandler, AppError } = require('../utils/errorHandler');
const { z } = require('zod');
const { validateRequest, validateQuery } = require('../middleware/validation');
const { getBranchFilter } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { logAction } = require('../utils/logger');
const { generateTemplate, parseExcelFile } = require('../utils/excel');

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
  bkcode: z.string().min(1, 'Code is required'), // Assuming bkcode is required
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
  if (!branchId && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Branch ID is required', 400);
  }

  // Parse the Excel file
  const rows = await parseExcelFile(req.file.buffer);

  if (rows.length === 0) {
    throw new AppError('No data found in file', 400);
  }

  // Log first row headers for debugging
  const firstRow = rows[0];
  const headers = Object.keys(firstRow);
  console.log('[Customer Import] Excel headers found:', headers);
  console.log('[Customer Import] First row sample:', firstRow);

  const results = {
    imported: 0,
    skipped: 0,
    errors: [],
    headers: headers // Include headers in response for debugging
  };

  let created = 0;
  let updated = 0;

  for (const row of rows) {
    try {
      // Map Excel headers to database field names (supporting Arabic headers from user's file)
      const bkcode = row['رقم العميل'] || row['كود العميل'] || row['bkcode'] || row['code'];
      const client_name = row['اسم العميل'] || row['client_name'] || row['name'];
      const address = row['العنوان'] || row['address'];
      const national_id = row['الرقم القومي'] || row['national_id'];
      const supply_office = row['مكتب التموين'] || row['supply_office'];
      const dept = row['إدارة التموين'] || row['dept'];
      const contact_person = row['الشخص المسؤول'] || row['contact_person'];
      const telephone_1 = row['رقم الهاتف 1'] || row['telephone_1'] || row['phone'];
      const telephone_2 = row['رقم الهاتف 2'] || row['telephone_2'] || row['mobile'];
      const clienttype = row['نوع العميل'] || row['clienttype'];

      if (!bkcode || !client_name) {
        results.skipped++;
        results.errors.push({ row: bkcode || JSON.stringify(row).slice(0, 100), error: 'Missing required fields (رقم العميل or اسم العميل)' });
        continue;
      }

      // Prepare customer data
      const customerData = {
        client_name: String(client_name),
        address: address ? String(address) : null,
        national_id: national_id ? String(national_id) : null,
        supply_office: supply_office ? String(supply_office) : null,
        dept: dept ? String(dept) : null,
        contact_person: contact_person ? String(contact_person) : null,
        telephone_1: telephone_1 ? String(telephone_1) : null,
        telephone_2: telephone_2 ? String(telephone_2) : null,
        clienttype: clienttype ? String(clienttype).trim() : null
      };

      // Check for existing customer in this branch
      const existing = await db.customer.findFirst({
        where: { bkcode: String(bkcode), branchId }
      });

      if (existing) {
        // Update existing customer - use updateMany to include branchId in where clause
        await db.customer.updateMany({
          where: { id: existing.id, branchId },
          data: customerData
        });
        updated++;
        results.imported++;
      } else {
        // Create new customer
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
      results.errors.push({ row: row['رقم العميل'] || row['كود العميل'] || 'Unknown', error: error.message });
    }
  }

  console.log(`[Customer Import] Results: ${created} created, ${updated} updated, ${results.skipped} skipped`);

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

  const { exportToExcel } = require('../utils/excel');

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
    { header: 'نوع العميل', key: 'clienttype', width: 15 },
    { header: 'الفرع', key: 'branchName', width: 20 }
  ];

  const data = customers.map(c => ({
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

  const buffer = await exportToExcel(data, columns, 'customers_export.xlsx');

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename=customers_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  res.send(buffer);
}));

// GET /lite - Dropdown list (Critical for frontend)
router.get('/lite', authenticateToken, asyncHandler(async (req, res) => {
  const where = getBranchFilter(req);
  const userRole = req.user.role;

  const hasSearch = req.query.search && req.query.search.trim().length > 0;

  // Allow ONLY admin/management to see all customers when searching
  if (hasSearch && ['SUPER_ADMIN', 'MANAGEMENT'].includes(userRole)) {
    where._skipBranchEnforcer = true;
    delete where.branchId;
  }

  if (hasSearch) {
    const search = req.query.search.trim();
    where.OR = [
      { client_name: { contains: search } },
      { bkcode: { startsWith: search } },
      { machines: { some: { serialNumber: { contains: search } } } }
    ];
  }

  const queryOptions = {
    where,
    select: {
      id: true,
      client_name: true,
      bkcode: true,
      branchId: true,
      machines: {
        select: {
          id: true,
          serialNumber: true,
          model: true
        }
      }
    },
    orderBy: { client_name: 'asc' }
  };

  // Increase limit for lite dropdown to be more useful, but keep it bounded
  if (!hasSearch) {
    queryOptions.take = 100;
  } else {
    queryOptions.take = 20; // Only return top 20 matches for performance
  }

  const customers = await db.customer.findMany(ensureBranchWhere(queryOptions, req));

  // Map machines to posMachines for frontend compatibility
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

  const queryOptions = {
    where,
    include: {
      branch: { select: { name: true } },
      machines: true,
      simCards: true
    },
    orderBy: { client_name: 'asc' }
  };

  if (limit) {
    queryOptions.take = limit;
    queryOptions.skip = offset;
  }

  const [customers, total] = await Promise.all([
    db.customer.findMany(ensureBranchWhere(queryOptions, req)),
    db.customer.count(ensureBranchWhere({ where }, req))
  ]);

  res.json({
    data: customers.map(c => ({
      ...c,
      posMachines: c.machines || []
    })),
    pagination: {
      total,
      limit: limit || total,
      offset: offset || 0,
      pages: limit ? Math.ceil(total / limit) : 1
    }
  });
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

  // Map machines to posMachines for frontend compatibility
  res.json({
    ...customer,
    posMachines: customer.machines || []
  });
}));

// POST / - Create customer
router.post('/', authenticateToken, validateRequest(customerSchema), asyncHandler(async (req, res) => {
  const { client_name, bkcode, phone, mobile, address } = req.body;
  const branchId = req.user.branchId || req.body.branchId;

  if (!branchId && req.user.role !== 'SUPER_ADMIN') {
    throw new AppError('Branch ID is required', 400);
  }

  // Check duplicate bkcode
  const existing = await db.customer.findFirst({
    where: { bkcode, branchId }
  });
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

  const updateData = req.body;

  // Prevent updating branchId if not admin? (Usually not allowed to move customers easily)
  if (req.user.role !== 'SUPER_ADMIN') {
    delete updateData.branchId;
  }

  await db.customer.updateMany({
    where: { id: req.params.id, branchId: req.user.branchId },
    data: updateData
  });

  const customer = await db.customer.findFirst({
    where: { id: req.params.id, branchId: req.user.branchId }
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
  // Check permissions
  if (!['SUPER_ADMIN', 'MANAGEMENT', 'BRANCH_MANAGER', 'CS_SUPERVISOR'].includes(req.user.role)) {
    throw new AppError('Access denied', 403);
  }

  const existing = await db.customer.findFirst(ensureBranchWhere({
    where: { id: req.params.id }
  }, req));

  if (!existing) throw new AppError('Customer not found', 404);

  // Check relations (Prevent delete if has POS or SIMs)
  const hasData = await db.customer.findFirst({
    where: { id: req.params.id },
    include: { _count: { select: { machines: true, simCards: true } } }
  });

  if (hasData._count.machines > 0 || hasData._count.simCards > 0) {
    throw new AppError('Cannot delete customer with active devices', 400);
  }

  await db.customer.deleteMany({
    where: {
      id: req.params.id,
      branchId: req.user.branchId
    }
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
