const express = require('express');
const router = express.Router();
const db = require('../db');
const ExcelJS = require('exceljs');
const authenticateToken = require('../middleware/auth');
const { getBranchFilter, requirePermission, PERMISSIONS } = require('../middleware/permissions');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const asyncHandler = require('../utils/asyncHandler');
const validate = require('../utils/validation/middleware');
const schemas = require('../utils/validation/schemas');
const { NotFoundError, ForbiddenError, AppError } = require('../utils/errors');
const logger = require('../utils/logger');

// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

/**
 * @route GET /api/customers
 * @summary Get all customers
 * @security bearerAuth
 * @returns {Array<Object>} List of customers
 */
router.get('/customers', authenticateToken, asyncHandler(async (req, res) => {
    const where = getBranchFilter(req);
    const customers = await db.customer.findMany(ensureBranchWhere({
        where,
        orderBy: { bkcode: 'asc' },
        include: {
            machines: true,
            simCards: true,
            branch: true
        }
    }, req));
    // Transform to match frontend expectations
    const transformed = customers.map(c => ({
        ...c,
        posMachines: c.machines,
        machines: undefined
    }));
    res.json(transformed);
}));

/**
 * @route GET /api/customers/lite
 * @summary Get customers in lightweight format for dropdowns
 * @security bearerAuth
 * @returns {Array<Object>} Lightweight customer list
 */
router.get('/customers/lite', authenticateToken, asyncHandler(async (req, res) => {
    const where = getBranchFilter(req);
    const customers = await db.customer.findMany(ensureBranchWhere({
        where,
        select: {
            bkcode: true,
            client_name: true,
            machines: {
                select: {
                    id: true,
                    serialNumber: true,
                    model: true
                }
            },
            simCards: {
                select: {
                    id: true,
                    serialNumber: true
                }
            }
        },
        orderBy: { client_name: 'asc' },
    }, req));
    // Transform to match frontend expectations
    const transformed = customers.map(c => ({
        ...c,
        posMachines: c.machines,
        machines: undefined
    }));
    res.json(transformed);
}));

/**
 * @route GET /api/customers/:id
 * @summary Get single customer by ID
 * @security bearerAuth
 * @param {string} id - Customer code (bkcode)
 * @returns {Object} Customer details
 */
router.get('/customers/:id', authenticateToken, asyncHandler(async (req, res) => {
    const customer = await db.customer.findUnique(ensureBranchWhere({
        where: { bkcode: req.params.id },
        include: {
            machines: true,
            simCards: true
        }
    }, req));

    // Manual check for branch isolation since findUnique doesn't support additional where clauses easily with same logic
    if (customer && req.user.branchId && customer.branchId !== req.user.branchId) {
        throw new ForbiddenError('Access denied to this customer');
    }
    if (!customer) {
        throw new NotFoundError('Customer');
    }
    res.json(customer);
}));

/**
 * @route POST /api/customers
 * @summary Create a new customer
 * @security bearerAuth
 * @body {Object} Customer data
 * @returns {Object} Created customer
 */
router.post('/customers', authenticateToken, validate('body', schemas.customer.create), asyncHandler(async (req, res) => {
    const branchId = req.user.branchId || req.body.branchId;
    if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
        throw new ForbiddenError('Branch ID is required');
    }

    const customer = await db.customer.create({
        data: {
            branchId,
            bkcode: req.body.bkcode,
            client_name: req.body.client_name,
            supply_office: req.body.supply_office,
            operating_date: req.body.operating_date ? new Date(req.body.operating_date) : null,
            address: req.body.address,
            contact_person: req.body.contact_person,
            scanned_id_path: req.body.scanned_id_path,
            national_id: req.body.national_id,
            dept: req.body.dept,
            telephone_1: req.body.telephone_1,
            telephone_2: req.body.telephone_2,
            has_gates: req.body.has_gates,
            bk_type: req.body.bk_type,
            clienttype: req.body.clienttype,
            notes: req.body.notes,
            papers_date: req.body.papers_date ? new Date(req.body.papers_date) : null,
            isSpecial: req.body.isSpecial,
        }
    });

    await logAction({
        entityType: 'CUSTOMER',
        entityId: customer.bkcode,
        action: 'CREATE',
        details: `Created customer ${customer.client_name}`,
        userId: req.user?.id,
        performedBy: req.user?.displayName || 'System',
        branchId: branchId
    });

    res.status(201).json(customer);
}));

const { logAction } = require('../utils/logger');

/**
 * @route PUT /api/customers/:id
 * @summary Update customer
 * @security bearerAuth
 * @param {string} id - Customer code
 * @body {Object} Updated customer data
 * @returns {Object} Updated customer
 */
router.put('/customers/:id', authenticateToken, validate('body', schemas.customer.update), asyncHandler(async (req, res) => {
    const existingCustomer = await db.customer.findUnique({ where: { bkcode: req.params.id } });

    if (!existingCustomer) throw new NotFoundError('Customer');

    if (req.user.branchId && existingCustomer.branchId !== req.user.branchId) {
        throw new ForbiddenError('Access denied');
    }

    const customer = await db.customer.update({
        where: { bkcode: req.params.id },
        data: {
            client_name: req.body.client_name,
            supply_office: req.body.supply_office,
            operating_date: req.body.operating_date ? new Date(req.body.operating_date) : null,
            address: req.body.address,
            contact_person: req.body.contact_person,
            scanned_id_path: req.body.scanned_id_path,
            national_id: req.body.national_id,
            dept: req.body.dept,
            telephone_1: req.body.telephone_1,
            telephone_2: req.body.telephone_2,
            has_gates: req.body.has_gates,
            bk_type: req.body.bk_type,
            clienttype: req.body.clienttype,
            notes: req.body.notes,
            papers_date: req.body.papers_date ? new Date(req.body.papers_date) : null,
            isSpecial: req.body.isSpecial,
        }
    });

    // Identify what changed
    const changes = {};
    const fieldsToCheck = ['client_name', 'telephone_1', 'telephone_2', 'address', 'contact_person', 'national_id', 'clienttype'];

    if (existingCustomer) {
        fieldsToCheck.forEach(field => {
            if (existingCustomer[field] !== customer[field] && (existingCustomer[field] || customer[field])) {
                changes[field] = { old: existingCustomer[field], new: customer[field] };
            }
        });

        if (Object.keys(changes).length > 0) {
            await logAction({
                entityType: 'CUSTOMER',
                entityId: customer.bkcode,
                action: 'UPDATE',
                details: JSON.stringify(changes),
                userId: req.user?.id,
                performedBy: req.user?.displayName || 'System',
                branchId: req.user?.branchId
            });
        }
    }

    res.json(customer);
}));

/**
 * @route DELETE /api/customers/:id
 * @summary Delete customer
 * @security bearerAuth
 * @param {string} id - Customer code
 * @returns {Object} Success message
 */
router.delete('/customers/:id', authenticateToken, asyncHandler(async (req, res) => {
    const existing = await db.customer.findUnique({ where: { bkcode: req.params.id } });
    if (existing) {
        if (req.user.branchId && existing.branchId !== req.user.branchId) {
            throw new ForbiddenError('Access denied');
        }
        await db.customer.delete({
            where: { bkcode: req.params.id }
        });
    }
    res.json({ success: true });
}));

/**
 * @route GET /api/customers/:id/machines
 * @summary Get customer's machines
 * @security bearerAuth
 * @param {string} id - Customer ID
 * @returns {Array<Object>} List of customer's machines
 */
router.get('/customers/:id/machines', authenticateToken, asyncHandler(async (req, res) => {
    const machines = await db.posMachine.findMany(ensureBranchWhere({
        where: {
            customerId: req.params.id,
            ...getBranchFilter(req)
        }
    }, req));
    res.json(machines);
}));

const multer = require('multer');
const { parseExcelFile } = require('../utils/excel');
const upload = multer({ storage: multer.memoryStorage() });

// POST import customers
router.post('/customers/import', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const customers = await parseExcelFile(req.file.buffer);

        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
            return res.status(400).json({ error: 'Branch ID is required for import' });
        }

        // WRAP ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
        const result = await db.$transaction(async (tx) => {
            let count = 0;
            let errors = [];

            for (const c of customers) {
                // Map Arabic headers to DB fields
                const mapped = {
                    bkcode: c['رقم العميل'] || c.bkcode,
                    client_name: c['اسم العميل'] || c.client_name,
                    address: c['العنوان'] || c.address,
                    national_id: c['الرقم القومي'] || c.national_id,
                    supply_office: c['مكتب التموين'] || c.supply_office,
                    dept: c['إدارة التموين'] || c.dept,
                    contact_person: c['الشخص المسؤول'] || c.contact_person,
                    telephone_1: c['رقم الهاتف 1'] || c.telephone_1,
                    telephone_2: c['رقم الهاتف 2'] || c.telephone_2,
                    notes: c['ملاحظات'] || c.notes,
                    clienttype: c['نوع العميل'] || c['تصنيف العميل'] || c.clienttype,
                    isSpecial: c.isSpecial
                };

                if (!mapped.bkcode || !mapped.client_name) {
                    errors.push({ bkcode: mapped.bkcode || 'UNKNOWN', error: 'Missing required fields (bkcode, client_name)' });
                    continue;
                }

                // Check if customer exists (branch-scoped)
                const existing = await tx.customer.findFirst({
                    where: {
                        bkcode: mapped.bkcode.toString(),
                        branchId
                    }
                });

                if (existing) {
                    // Update
                    try {
                        await tx.customer.update({
                            where: { bkcode: mapped.bkcode.toString() },
                            data: {
                                client_name: mapped.client_name,
                                address: mapped.address || existing.address,
                                telephone_1: mapped.telephone_1?.toString() || existing.telephone_1,
                                telephone_2: mapped.telephone_2?.toString() || existing.telephone_2,
                                contact_person: mapped.contact_person || existing.contact_person,
                                national_id: mapped.national_id?.toString() || existing.national_id,
                                supply_office: mapped.supply_office || existing.supply_office,
                                dept: mapped.dept || existing.dept,
                                clienttype: mapped.clienttype || existing.clienttype,
                                notes: mapped.notes || existing.notes,
                                isSpecial: mapped.isSpecial === 'true' || mapped.isSpecial === true || existing.isSpecial
                            }
                        });
                        count++;
                    } catch (updateError) {
                        errors.push({ bkcode: mapped.bkcode, error: updateError.message });
                    }
                } else {
                    // Create
                    try {
                        await tx.customer.create({
                            data: {
                                bkcode: mapped.bkcode.toString(),
                                branchId,
                                client_name: mapped.client_name,
                                address: mapped.address || null,
                                telephone_1: mapped.telephone_1?.toString() || null,
                                telephone_2: mapped.telephone_2?.toString() || null,
                                contact_person: mapped.contact_person || null,
                                national_id: mapped.national_id?.toString() || null,
                                supply_office: mapped.supply_office || null,
                                dept: mapped.dept || null,
                                clienttype: mapped.clienttype || null,
                                notes: mapped.notes || null,
                                has_gates: false,
                                isSpecial: mapped.isSpecial === 'true' || mapped.isSpecial === true
                            }
                        });
                        count++;
                    } catch (createError) {
                        errors.push({ bkcode: mapped.bkcode, error: createError.message });
                    }
                }
            }

            return { count, errors };
        });

        // Log successful import (AFTER transaction)
        await logAction({
            entityType: 'CUSTOMER',
            entityId: 'BULK_IMPORT',
            action: 'IMPORT',
            details: `استيراد عملاء - المعالج: ${result.count}, أخطاء: ${result.errors.length}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId
        });

        res.json({ success: true, count: result.count, errors: result.errors.length > 0 ? result.errors : undefined });
    } catch (error) {
        logger.error({ err: error, userId: req.user?.id, branchId: req.user?.branchId }, 'Failed to import customers');
        res.status(500).json({ error: 'Failed to import customers' });
    }
});



// GET customer template
router.get('/customers/template/download', async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template
        const worksheet = workbook.addWorksheet('Clients');
        worksheet.columns = [
            { header: 'رقم العميل', key: 'bkcode', width: 15 },
            { header: 'اسم العميل', key: 'client_name', width: 30 },
            { header: 'العنوان', key: 'address', width: 40 },
            { header: 'الرقم القومي', key: 'national_id', width: 20 },
            { header: 'مكتب التموين', key: 'supply_office', width: 20 },
            { header: 'إدارة التموين', key: 'dept', width: 20 },
            { header: 'الشخص المسؤول', key: 'contact_person', width: 20 },
            { header: 'رقم الهاتف 1', key: 'telephone_1', width: 15 },
            { header: 'رقم الهاتف 2', key: 'telephone_2', width: 15 },
            { header: 'ملاحظات', key: 'notes', width: 30 },
            { header: 'نوع العميل', key: 'clienttype', width: 20 }
        ];

        // Sheet 2: Help (Valid Client Types)
        const helpSheet = workbook.addWorksheet('Valid Values');
        helpSheet.columns = [
            { header: 'Client Types', key: 'name', width: 25 },
            { header: 'Description', key: 'description', width: 40 }
        ];

        const types = await db.clientType.findMany({ orderBy: { name: 'asc' } });
        types.forEach(t => {
            helpSheet.addRow({ name: t.name, description: t.description || '' });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customers_import.xlsx');

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        logger.error({ err: error, userId: req.user?.id }, 'Failed to generate template');
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

module.exports = router;
