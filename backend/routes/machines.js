const express = require('express');
const router = express.Router();
const { z } = require('zod');
const multer = require('multer');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest } = require('../middleware/validation');
const { generateTemplate, parseExcelFile, exportToExcel } = require('../utils/excel');
const { logAction } = require('../utils/logger');
const { ensureBranchWhere } = require('../prisma/branchHelpers');

const upload = multer({ storage: multer.memoryStorage() });

// Validation Schemas
const applyParametersSchema = z.object({
    dryRun: z.boolean().optional().default(false)
});

// GET template for Machine import
router.get('/machines/template', authenticateToken, async (req, res) => {
    try {
        const columns = [
            { header: 'serialNumber', key: 'serialNumber', width: 25 },
            { header: 'customerId', key: 'customerId', width: 15 },
            { header: 'posId', key: 'posId', width: 15 } // Added
        ];

        const buffer = await generateTemplate(columns, 'customer_machines_import.xlsx');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=customer_machines_import.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Failed to generate Machines template:', error);
        res.status(500).json({ error: 'فشل في إنشاء القالب' });
    }
});

// POST import Machines from Excel
router.post('/machines/import', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ملف مطلوب' });
        }

        const rows = await parseExcelFile(req.file.buffer);

        // Get branchId from user
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
            return res.status(400).json({ error: 'معرف الفرع مطلوب' });
        }

        // Get all machine parameters for auto-detection
        const machineParams = await db.machineParameter.findMany();

        let skippedCount = 0;

        // Helper function to detect model and manufacturer from serial
        const detectMachineInfo = (serialNumber) => {
            const sn = serialNumber.toString();
            for (const param of machineParams) {
                if (sn.startsWith(param.prefix)) {
                    return {
                        model: param.model,
                        manufacturer: param.manufacturer
                    };
                }
            }
            return { model: null, manufacturer: null };
        };

        let successCount = 0;
        let updatedCount = 0;
        let errors = [];

        for (const row of rows) {
            try {
                // Normalize inputs - handle potential property name casing/spaces from Excel
                const rawSerial = row.serialNumber || row['serialNumber'] || row['SerialNumber'] || row['Serial Number'];
                const serialNumber = rawSerial ? String(rawSerial).trim() : null;

                const rawCustomerId = row.customerId || row['customerId'] || row['CustomerId'] || row['Customer ID'];
                const customerId = rawCustomerId ? String(rawCustomerId).trim() : null;

                const rawPosId = row.posId || row['posId'] || row['PosId'] || row['POS ID'];
                const posId = rawPosId ? String(rawPosId).trim() : null;

                // Validate
                if (!serialNumber) {
                    errors.push({ row, error: 'الرقم التسلسلي مطلوب' });
                    continue;
                }

                // Validate customer if provided (branch-scoped) and get their actual ID
                let actualCustomerId = null;
                if (customerId) {
                    const customer = await db.customer.findFirst({
                        where: {
                            bkcode: customerId,
                            branchId
                        }
                    });

                    if (!customer) {
                        errors.push({ row: { ...row, serialNumber }, error: `العميل ${customerId} غير موجود في هذا الفرع` });
                        continue;
                    }
                    // Use the actual customer ID (cuid), not the bkcode
                    actualCustomerId = customer.id;
                }

                // Auto-detect model and manufacturer from parameters
                const { model, manufacturer } = detectMachineInfo(serialNumber);

                // Check if machine already exists (Globally or in Branch?)
                // Schema has @unique on serialNumber, so it's global
                const existing = await db.posMachine.findFirst({
                    where: {
                        serialNumber: serialNumber,
                        // Satisfy branchEnforcer while still checking all branches
                        OR: [
                            { branchId: branchId },
                            { branchId: { not: branchId } },
                            { branchId: null }
                        ]
                    }
                });

                if (existing) {
                    // Check if it belongs to another branch
                    if (existing.branchId && existing.branchId !== branchId) {
                        errors.push({
                            row: { ...row, serialNumber },
                            error: `الماكينة مسجلة بالفعل في فرع آخر`
                        });
                        continue;
                    }

                    // Update existing machine
                    await db.posMachine.update({
                        where: {
                            id: existing.id,
                            branchId: existing.branchId
                        },
                        data: {
                            customerId: actualCustomerId,
                            branchId: branchId, // Ensure it's set to current branch if it was null
                            model: model || existing.model,
                            manufacturer: manufacturer || existing.manufacturer,
                            posId: posId || existing.posId
                        }
                    });
                    updatedCount++;
                } else {
                    // Create new machine
                    await db.posMachine.create({
                        data: {
                            serialNumber: serialNumber,
                            branchId,
                            customerId: actualCustomerId,
                            model: model,
                            manufacturer: manufacturer,
                            posId: posId
                        }
                    });
                    successCount++;
                }
            } catch (err) {
                console.error('Row import error:', err);
                errors.push({
                    row,
                    error: err.message || 'خطأ غير معروف في هذا السجل'
                });
            }
        }

        const result = { successCount, updatedCount, errors };

        // Log successful import (AFTER transaction)
        await logAction({
            entityType: 'POS_MACHINE',
            entityId: 'BULK_IMPORT',
            action: 'IMPORT',
            details: `استيراد ماكينات - جديد: ${result.successCount}, محدث: ${result.updatedCount}, أخطاء: ${result.errors.length}`,
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId
        });

        res.json({
            success: true,
            created: result.successCount,
            updated: result.updatedCount,
            skipped: skippedCount,
            errors: result.errors.length > 0 ? result.errors : undefined
        });

    } catch (error) {
        console.error('Failed to import Machines:', error);
        res.status(500).json({ error: 'فشل في استيراد الماكينات' });
    }
});

// GET export Machines to Excel
router.get('/machines/export', authenticateToken, async (req, res) => {
    try {
        const machines = await db.posMachine.findMany(ensureBranchWhere({
            include: {
                customer: true
            },
            orderBy: { serialNumber: 'asc' }
        }, req));

        const data = machines.map(machine => ({
            serialNumber: machine.serialNumber,
            model: machine.model || '',
            manufacturer: machine.manufacturer || '',
            customerId: machine.customerId || '',
            customerName: machine.customer?.client_name || '',
            posId: machine.posId || ''
        }));

        const columns = [
            { header: 'serialNumber', key: 'serialNumber', width: 25 },
            { header: 'model', key: 'model', width: 20 },
            { header: 'manufacturer', key: 'manufacturer', width: 20 },
            { header: 'customerId', key: 'customerId', width: 15 },
            { header: 'customerName', key: 'customerName', width: 30 },
            { header: 'posId', key: 'posId', width: 15 }
        ];

        const buffer = await exportToExcel(data, columns, 'machines-export.xlsx');

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=machines-export.xlsx');
        res.send(buffer);

    } catch (error) {
        console.error('Failed to export Machines:', error);
        res.status(500).json({ error: 'فشل في تصدير الماكينات' });
    }
});

// GET all Machines with customer info
router.get('/machines', authenticateToken, async (req, res) => {
    try {
        const machines = await db.posMachine.findMany(ensureBranchWhere({
            include: {
                customer: {
                    select: {
                        bkcode: true,
                        client_name: true
                    }
                }
            },
            orderBy: { serialNumber: 'asc' }
        }, req));

        res.json(machines);
    } catch (error) {
        console.error('Failed to fetch Machines:', error);
        res.status(500).json({ error: 'فشل في جلب الماكينات' });
    }
});

// POST apply parameters to machines missing model/manufacturer
router.post('/machines/apply-parameters', authenticateToken, validateRequest(applyParametersSchema), async (req, res) => {
    try {
        // Get all machine parameters
        const machineParams = await db.machineParameter.findMany();

        // Find machines missing model or manufacturer
        const machinesToUpdate = await db.posMachine.findMany(ensureBranchWhere({
            where: {
                OR: [
                    { model: null },
                    { manufacturer: null },
                    { model: '' },
                    { manufacturer: '' }
                ]
            }
        }, req));

        let updatedCount = 0;

        // Perform updates in parallel-ish batches? No, sequential is safer for SQLite/transaction loops
        // But for plain updates, fine to loop.

        // Optimization: Use transaction
        await db.$transaction(async (tx) => {
            for (const machine of machinesToUpdate) {
                // Find matching parameter by prefix
                const matchingParam = machineParams.find(param =>
                    machine.serialNumber.startsWith(param.prefix)
                );

                if (matchingParam) {
                    await tx.posMachine.updateMany({
                        where: { id: machine.id, branchId: machine.branchId },
                        data: {
                            model: matchingParam.model,
                            manufacturer: matchingParam.manufacturer
                        }
                    });
                    updatedCount++;
                }
            }
        });

        res.json({
            success: true,
            checked: machinesToUpdate.length,
            updated: updatedCount
        });

    } catch (error) {
        console.error('Failed to apply parameters:', error);
        res.status(500).json({ error: 'فشل في تطبيق الإعدادات' });
    }
});

module.exports = router;
