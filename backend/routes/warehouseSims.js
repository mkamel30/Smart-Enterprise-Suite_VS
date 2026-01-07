const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const ExcelJS = require('exceljs');
const multer = require('multer');
const { getBranchFilter, canAccessBranch } = require('../utils/auth-helpers');
const movementService = require('../services/movementService');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

const upload = multer({ storage: multer.memoryStorage() });


// GET all warehouse SIMs
router.get('/', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;
        const where = { ...branchFilter };

        if (targetBranchId && (req.user.role === 'SUPER_ADMIN' || req.user.role === 'MANAGEMENT')) {
            where.branchId = targetBranchId;
        }

        if (req.query.status) {
            where.status = req.query.status;
        }

        const sims = await db.warehouseSim.findMany(ensureBranchWhere({
            where,
            orderBy: { importDate: 'desc' },
            include: { branch: true }
        }, req));
        res.json(sims);
    } catch (error) {
        console.error('Failed to fetch warehouse SIMs:', error);
        res.status(500).json({ error: 'Failed to fetch warehouse SIMs' });
    }
});

// GET warehouse SIM counts by status and type
router.get('/counts', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const targetBranchId = req.query.branchId;
        const where = { ...branchFilter };

        if (targetBranchId && (['SUPER_ADMIN', 'MANAGEMENT', 'CENTER_MANAGER'].includes(req.user.role))) {
            where.branchId = targetBranchId;
        }

        // Count by status
        const statusCounts = await db.warehouseSim.groupBy(ensureBranchWhere({
            by: ['status'],
            where,
            _count: true
        }, req));

        // Count by type
        const typeCounts = await db.warehouseSim.groupBy(ensureBranchWhere({
            by: ['type'],
            where,
            _count: true
        }, req));

        const result = {
            ACTIVE: 0,
            DEFECTIVE: 0,
            IN_TRANSIT: 0,
            total: 0,
            byType: {}
        };

        statusCounts.forEach((c) => {
            result[c.status] = c._count;
            result.total += c._count;
        });

        typeCounts.forEach((c) => {
            const typeName = c.type || 'غير محدد';
            result.byType[typeName] = c._count;
        });

        res.json(result);
    } catch (error) {
        console.error('Failed to fetch SIM counts:', error);
        res.status(500).json({ error: 'Failed to fetch counts' });
    }
});

// POST create warehouse SIM
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { serialNumber, type, status, notes } = req.body;

        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId) return res.status(400).json({ error: 'Branch ID required' });

        // Check if SIM already exists
        const existing = await db.warehouseSim.findUnique({
            where: { serialNumber }
        });

        if (existing) {
            return res.status(400).json({ error: 'رقم الشريحة موجود بالفعل' });
        }

        const sim = await db.warehouseSim.create({
            data: {
                branchId,
                serialNumber,
                type: type || null,
                status: status || 'ACTIVE',
                notes: notes || null
            }
        });

        res.status(201).json(sim);
    } catch (error) {
        console.error('Failed to create warehouse SIM:', error);
        res.status(500).json({ error: 'Failed to create SIM' });
    }
});

// PUT update warehouse SIM
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { serialNumber, type, status, notes } = req.body;

        const existing = await db.warehouseSim.findUnique({ where: { id } });
        if (!existing) return res.status(404).json({ error: 'SIM not found' });

        if (req.user.branchId && existing.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied' });
        }

        // VALIDATION: Prevent manual status change to IN_TRANSIT
        // IN_TRANSIT can only be set through transfer orders
        if (status === 'IN_TRANSIT' && existing.status !== 'IN_TRANSIT') {
            return res.status(400).json({
                error: 'لا يمكن تغيير الحالة إلى "قيد النقل" يدوياً. يجب إنشاء إذن تحويل.'
            });
        }

        const sim = await db.warehouseSim.update({
            where: { id },
            data: {
                serialNumber,
                type,
                status,
                notes
            }
        });

        res.json(sim);
    } catch (error) {
        console.error('Failed to update warehouse SIM:', error);
        res.status(500).json({ error: 'Failed to update SIM' });
    }
});

// DELETE warehouse SIM
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        const existing = await db.warehouseSim.findUnique({ where: { id: req.params.id } });
        if (existing) {
            if (req.user.branchId && existing.branchId !== req.user.branchId) {
                return res.status(403).json({ error: 'Access denied' });
            }
            await db.warehouseSim.delete({
                where: { id: req.params.id }
            });
        }
        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete warehouse SIM:', error);
        res.status(500).json({ error: 'Failed to delete SIM' });
    }
});

// POST assign SIM to customer (purchase)
router.post('/assign', authenticateToken, async (req, res) => {
    try {
        const { customerId, simId, cost, receiptNumber, paymentPlace, performedBy } = req.body;

        const branchId = req.user.branchId || req.body.branchId;

        // Validate customer
        const customer = await db.customer.findFirst({
            where: { bkcode: customerId, branchId }
        });
        if (!customer) {
            return res.status(400).json({ error: 'العميل غير موجود' });
        }
        if (req.user.branchId && customer.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to customer' });
        }

        // Validate SIM exists in warehouse and is ACTIVE
        const warehouseSim = await db.warehouseSim.findUnique({
            where: { id: simId }
        });
        if (!warehouseSim) {
            return res.status(400).json({ error: 'الشريحة غير موجودة في المخزن' });
        }
        if (req.user.branchId && warehouseSim.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to warehouse SIM' });
        }

        if (warehouseSim.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'الشريحة غير سليمة' });
        }

        // Use transaction
        const result = await db.$transaction(async (tx) => {
            // Create payment if cost > 0
            if (cost && cost > 0) {
                await tx.payment.create({
                    data: {
                        branchId: customer.branchId, // Link payment to customer's branch
                        customerId,
                        customerName: customer.client_name,
                        amount: cost,
                        receiptNumber: receiptNumber || null,
                        paymentPlace: paymentPlace || null,
                        type: 'SIM_PURCHASE',
                        reason: `شراء شريحة ${warehouseSim.serialNumber}`,
                        notes: `نوع الشريحة: ${warehouseSim.type || 'غير محدد'}`
                    }
                });
            }

            // Create SimCard
            const clientSim = await tx.simCard.create({
                data: {
                    serialNumber: warehouseSim.serialNumber,
                    type: warehouseSim.type,
                    customerId
                }
            });

            // Delete from warehouse
            await tx.warehouseSim.delete({
                where: { id: simId }
            });

            // Log movement using centralized service
            await movementService.logSimMovement(tx, {
                simId: warehouseSim.id,
                serialNumber: warehouseSim.serialNumber,
                action: 'ASSIGN',
                customerId,
                details: {
                    customerName: customer.client_name,
                    type: warehouseSim.type,
                    cost: cost || 0,
                    receiptNumber
                },
                performedBy: req.user?.displayName || performedBy || 'System',
                branchId: customer.branchId
            });

            return clientSim;
        });

        res.json({ success: true, simCard: result });
    } catch (error) {
        console.error('Failed to assign SIM:', error);
        res.status(500).json({ error: 'فشل تعيين الشريحة للعميل' });
    }
});

// POST exchange SIM (customer returns old, gets new)
router.post('/exchange', authenticateToken, async (req, res) => {
    try {
        const {
            customerId,
            returningSimSerial,
            newSimId,
            returningStatus,
            returningType,
            cost,
            receiptNumber,
            paymentPlace,
            notes,
            performedBy
        } = req.body;

        const branchId = req.user.branchId || req.body.branchId;

        // Validate customer
        const customer = await db.customer.findFirst({
            where: { bkcode: customerId, branchId }
        });
        if (!customer) {
            return res.status(400).json({ error: 'العميل غير موجود' });
        }
        if (req.user.branchId && customer.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to customer' });
        }

        // Validate returning SIM belongs to customer
        const returningSim = await db.simCard.findFirst({
            where: {
                serialNumber: returningSimSerial,
                customerId
            }
        });
        if (!returningSim) {
            return res.status(400).json({ error: 'الشريحة المرتجعة غير موجودة عند العميل' });
        }

        // Validate new SIM in warehouse
        const newSim = await db.warehouseSim.findUnique({
            where: { id: newSimId }
        });
        if (!newSim) {
            return res.status(400).json({ error: 'الشريحة الجديدة غير موجودة في المخزن' });
        }
        if (req.user.branchId && newSim.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to new SIM' });
        }

        if (newSim.status !== 'ACTIVE') {
            return res.status(400).json({ error: 'الشريحة الجديدة غير سليمة' });
        }

        // Use transaction
        const result = await db.$transaction(async (tx) => {
            // Create payment if cost > 0
            if (cost && cost > 0) {
                await tx.payment.create({
                    data: {
                        branchId: customer.branchId,
                        customerId,
                        customerName: customer.client_name,
                        amount: cost,
                        receiptNumber: receiptNumber || null,
                        paymentPlace: paymentPlace || null,
                        type: 'SIM_EXCHANGE',
                        reason: `استبدال شريحة ${returningSimSerial} بـ ${newSim.serialNumber}`,
                        notes: notes || null
                    }
                });
            }

            // Delete old SIM from customer
            await tx.simCard.delete({
                where: { id: returningSim.id }
            });

            // Add old SIM to warehouse (Assign to branchId of customer/user)
            await tx.warehouseSim.create({
                data: {
                    branchId: customer.branchId, // Assign to customer's branch
                    serialNumber: returningSimSerial,
                    type: returningType || returningSim.type,
                    status: returningStatus || 'ACTIVE',
                    notes: notes || null
                }
            });

            // Create new SimCard
            const clientSim = await tx.simCard.create({
                data: {
                    serialNumber: newSim.serialNumber,
                    type: newSim.type,
                    customerId
                }
            });

            // Delete new SIM from warehouse
            await tx.warehouseSim.delete({
                where: { id: newSimId }
            });

            // Log EXCHANGE_OUT (old SIM returning) using centralized service
            await movementService.logSimMovement(tx, {
                simId: returningSim.id,
                serialNumber: returningSimSerial,
                action: 'EXCHANGE_OUT',
                customerId,
                details: {
                    customerName: customer.client_name,
                    status: returningStatus,
                    type: returningType || returningSim.type,
                    reason: notes
                },
                performedBy: req.user?.displayName || performedBy || 'System',
                branchId: customer.branchId
            });

            // Log EXCHANGE_IN (new SIM going to customer) using centralized service
            await movementService.logSimMovement(tx, {
                simId: clientSim.id,
                serialNumber: newSim.serialNumber,
                action: 'EXCHANGE_IN',
                customerId,
                details: {
                    customerName: customer.client_name,
                    type: newSim.type,
                    cost: cost || 0,
                    exchangedFor: returningSimSerial
                },
                performedBy: req.user?.displayName || performedBy || 'System',
                branchId: customer.branchId
            });

            return clientSim;
        });

        res.json({ success: true, simCard: result });
    } catch (error) {
        console.error('Failed to exchange SIM:', error);
        res.status(500).json({ error: 'فشل استبدال الشريحة' });
    }
});

// POST return SIM from customer to warehouse
router.post('/return', authenticateToken, async (req, res) => {
    try {
        const { customerId, simSerial, status, type, notes, performedBy } = req.body;
        const branchId = req.user.branchId || req.body.branchId;

        // Validate returning SIM belongs to customer
        const returningSim = await db.simCard.findFirst({
            where: {
                serialNumber: simSerial,
                customerId
            }
        });
        if (!returningSim) {
            return res.status(400).json({ error: 'الشريحة غير موجودة عند العميل' });
        }

        const customer = await db.customer.findFirst({
            where: { bkcode: customerId, branchId }
        });

        if (req.user.branchId && customer && customer.branchId !== req.user.branchId) {
            return res.status(403).json({ error: 'Access denied to customer' });
        }


        // Use transaction
        await db.$transaction(async (tx) => {
            // Delete from customer
            await tx.simCard.delete({
                where: { id: returningSim.id }
            });

            // Add to warehouse
            await tx.warehouseSim.create({
                data: {
                    branchId: customer?.branchId || branchId, // Use customer branch or fallback
                    serialNumber: simSerial,
                    type: type || returningSim.type,
                    status: status || 'ACTIVE',
                    notes: notes || null
                }
            });

            // Log movement using centralized service
            await movementService.logSimMovement(tx, {
                simId: returningSim.id,
                serialNumber: simSerial,
                action: 'RETURN',
                customerId,
                details: {
                    customerName: customer?.client_name,
                    status,
                    type: type || returningSim.type,
                    notes
                },
                performedBy: req.user?.displayName || performedBy || 'System',
                branchId: customer?.branchId || branchId
            });
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to return SIM:', error);
        res.status(500).json({ error: 'فشل إرجاع الشريحة للمخزن' });
    }
});

// GET SIM movement history
router.get('/movements', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.query;
        const where = serialNumber ? { serialNumber } : {};

        const branchFilter = getBranchFilter(req);
        const movements = await db.simMovementLog.findMany(ensureBranchWhere({
            where: {
                ...where,
                ...branchFilter
            },
            orderBy: { createdAt: 'desc' },
            take: 100
        }, req));
        res.json(movements);
    } catch (error) {
        console.error('Failed to fetch SIM movements:', error);
        res.status(500).json({ error: 'Failed to fetch movements' });
    }
});

// GET download template
router.get('/template', authenticateToken, async (req, res) => {
    try {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('SIM Cards');

        // Headers
        worksheet.columns = [
            { header: 'مسلسل الشريحة', key: 'serialNumber', width: 25 },
            { header: 'نوع الشريحة', key: 'type', width: 20 },
            { header: 'الحالة', key: 'status', width: 15 },
            { header: 'ملاحظات', key: 'notes', width: 30 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        // Add example rows
        worksheet.addRow({
            serialNumber: '8920100000000001',
            type: 'Vodafone',
            status: 'سليمة',
            notes: 'مثال'
        });
        worksheet.addRow({
            serialNumber: '8920100000000002',
            type: 'Orange',
            status: 'تالفة',
            notes: ''
        });

        // Add valid values sheet
        const validSheet = workbook.addWorksheet('القيم المتاحة');
        validSheet.columns = [
            { header: 'نوع الشريحة', key: 'type', width: 20 },
            { header: 'الحالة', key: 'status', width: 15 }
        ];
        validSheet.getRow(1).font = { bold: true };

        // Valid types
        const types = ['Vodafone', 'Orange', 'Etisalat', 'WE', 'أخرى'];
        const statuses = ['سليمة', 'تالفة'];

        types.forEach((t, i) => {
            validSheet.getRow(i + 2).getCell(1).value = t;
        });
        statuses.forEach((s, i) => {
            validSheet.getRow(i + 2).getCell(2).value = s;
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=warehouse_sims_import.xlsx');

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Failed to generate template:', error);
        res.status(500).json({ error: 'Failed to generate template' });
    }
});

// POST import from Excel
router.post('/import', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId) return res.status(400).json({ error: 'Branch ID required for import' });


        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.load(req.file.buffer);

        const worksheet = workbook.worksheets[0];
        const sims = [];
        const errors = [];
        let imported = 0;
        let skipped = 0;

        worksheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return; // Skip header

            const serialNumber = row.getCell(1).value?.toString()?.trim();
            const type = row.getCell(2).value?.toString()?.trim() || null;
            const statusText = row.getCell(3).value?.toString()?.trim() || 'سليمة';
            const notes = row.getCell(4).value?.toString()?.trim() || null;

            if (!serialNumber) return;

            // Map Arabic status to English
            let status = 'ACTIVE';
            if (statusText === 'تالفة' || statusText.toLowerCase() === 'defective') {
                status = 'DEFECTIVE';
            }

            sims.push({
                serialNumber,
                type,
                status,
                notes
            });
        });

        // Import each SIM
        for (const sim of sims) {
            try {
                // Check if exists
                const existing = await db.warehouseSim.findUnique({
                    where: { serialNumber: sim.serialNumber }
                });

                if (existing) {
                    if (existing.branchId !== branchId) {
                        skipped++;
                        errors.push({ serial: sim.serialNumber, error: 'موجودة في فرع آخر' });
                        continue;
                    }
                    skipped++;
                    errors.push({ serial: sim.serialNumber, error: 'موجودة مسبقاً' });
                    continue;
                }

                await db.warehouseSim.create({ data: { ...sim, branchId } });
                imported++;
            } catch (e) {
                skipped++;
                errors.push({ serial: sim.serialNumber, error: e.message });
            }
        }

        res.json({
            success: true,
            imported,
            skipped,
            total: sims.length,
            errors: errors.slice(0, 10) // Only return first 10 errors
        });
    } catch (error) {
        console.error('Failed to import SIMs:', error);
        res.status(500).json({ error: 'Failed to import SIMs' });
    }
});

// GET export to Excel
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const where = getBranchFilter(req);
        const sims = await db.warehouseSim.findMany(ensureBranchWhere({
            where,
            orderBy: { importDate: 'desc' }
        }, req));

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('SIM Cards');

        // Headers
        worksheet.columns = [
            { header: 'مسلسل الشريحة', key: 'serialNumber', width: 25 },
            { header: 'نوع الشريحة', key: 'type', width: 20 },
            { header: 'الحالة', key: 'status', width: 15 },
            { header: 'ملاحظات', key: 'notes', width: 30 },
            { header: 'تاريخ الإضافة', key: 'importDate', width: 20 }
        ];

        // Style header row
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4CAF50' }
        };
        worksheet.getRow(1).font.color = { argb: 'FFFFFFFF' };

        // Add data
        sims.forEach(sim => {
            worksheet.addRow({
                serialNumber: sim.serialNumber,
                type: sim.type || '-',
                status: sim.status === 'ACTIVE' ? 'سليمة' : 'تالفة',
                notes: sim.notes || '',
                importDate: new Date(sim.importDate).toLocaleDateString('ar-EG')
            });
        });

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=sim_warehouse_${new Date().toISOString().slice(0, 10)}.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Failed to export SIMs:', error);
        res.status(500).json({ error: 'Failed to export SIMs' });
    }
});

// POST transfer SIMs to branch (Bulk)
router.post('/transfer', authenticateToken, async (req, res) => {
    try {
        const { simIds, targetBranchId, notes } = req.body;
        const fromBranchId = req.user.branchId;

        if (!Array.isArray(simIds) || simIds.length === 0) {
            return res.status(400).json({ error: 'No SIMs selected' });
        }

        if (!targetBranchId) {
            return res.status(400).json({ error: 'Target branch required' });
        }

        // Validate target branch
        const targetBranch = await db.branch.findUnique({
            where: { id: targetBranchId }
        });
        if (!targetBranch) {
            return res.status(400).json({ error: 'Target branch not found' });
        }

        // Validate sims exist and user has access
        const sims = await db.warehouseSim.findMany(ensureBranchWhere({
            where: {
                id: { in: simIds }
            }
        }, req));

        if (sims.length !== simIds.length) {
            return res.status(400).json({ error: 'Some SIMs not found or access denied' });
        }

        // Use transaction
        const result = await db.$transaction(async (tx) => {
            // 1. Create Transfer Order
            const orderNumber = `TO-SIM-${Date.now()}`;
            const order = await tx.transferOrder.create({
                data: {
                    orderNumber,
                    fromBranchId: fromBranchId || (sims[0] ? sims[0].branchId : null),
                    toBranchId: targetBranchId,
                    branchId: targetBranchId, // Visibility for target branch
                    type: 'SIM',
                    notes,
                    createdByUserId: req.user.id,
                    createdByName: req.user.displayName || req.user.name || 'النظام',
                    items: {
                        create: sims.map(sim => ({
                            serialNumber: sim.serialNumber,
                            type: sim.type || 'SIM',
                            isReceived: false
                        }))
                    }
                }
            });

            // 2. Create Notification for the receiving branch
            await tx.notification.create({
                data: {
                    branchId: targetBranchId,
                    type: 'TRANSFER_ORDER',
                    title: 'إذن نقل شرائح جديد',
                    message: `تم إرسال ${sims.length} شريحة من ${req.user.displayName}`,
                    link: '/receive-orders',
                    data: JSON.stringify({ orderId: order.id, orderNumber: orderNumber })
                }
            });

            // 3. Mark items as IN_TRANSIT in the source warehouse
            // They stay in the source branch until received at the destination
            await tx.warehouseSim.updateMany({
                where: { id: { in: simIds } },
                data: { status: 'IN_TRANSIT' }
            });

            // Log movement for each SIM as TRANSFER_OUT
            for (const sim of sims) {
                await movementService.logSimMovement(tx, {
                    simId: sim.id,
                    serialNumber: sim.serialNumber,
                    action: 'TRANSFER_OUT',
                    details: {
                        toBranch: targetBranch.name,
                        orderNumber
                    },
                    performedBy: req.user.displayName,
                    branchId: fromBranchId || sim.branchId
                });
            }

            return order;
        });

        res.json({ success: true, order: result });
    } catch (error) {
        console.error('Failed to transfer SIMs:', error);
        res.status(500).json({ error: 'Failed to transfer SIMs' });
    }
});

module.exports = router;
