const express = require('express');
const router = express.Router();
const db = require('../db');
const authenticateToken = require('../middleware/auth');
const { generateTemplate, parseExcelFile, exportToExcel } = require('../utils/excel');
const { logAction } = require('../utils/logger');
const multer = require('multer');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL
const upload = multer({ storage: multer.memoryStorage() });

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
        res.status(500).json({ error: 'Failed to generate template' });
    }
});



// POST import Machines from Excel
router.post('/machines/import', authenticateToken, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const rows = await parseExcelFile(req.file.buffer);

        // Get branchId from user
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId || typeof branchId !== 'string' || branchId.trim() === '') {
            return res.status(400).json({ error: 'Branch ID is required for import' });
        }

        // Get all machine parameters for auto-detection
        const machineParams = await db.machineParameter.findMany();

        let successCount = 0;
        let skippedCount = 0;
        let updatedCount = 0;
        let errors = [];

        // Helper function to detect model and manufacturer from serial
        const detectMachineInfo = (serialNumber) => {
            for (const param of machineParams) {
                if (serialNumber.startsWith(param.prefix)) {
                    return {
                        model: param.model,
                        manufacturer: param.manufacturer
                    };
                }
            }
            return { model: null, manufacturer: null };
        };

        // WRAP ALL OPERATIONS IN TRANSACTION FOR ATOMICITY
        const result = await db.$transaction(async (tx) => {
            let successCount = 0;
            let updatedCount = 0;
            let errors = [];

            for (const row of rows) {
                const serialNumber = row.serialNumber || row['serialNumber'];
                const customerId = row.customerId || row['customerId'] || null;
                const posId = row.posId || row['posId'] || null;

                // Validate
                if (!serialNumber) {
                    errors.push({ row, error: 'serialNumber is required' });
                    continue;
                }

                // Validate customer if provided (branch-scoped)
                if (customerId) {
                    const customer = await tx.customer.findFirst({
                        where: { 
                            bkcode: customerId.toString(),
                            branchId
                        }
                    });

                    if (!customer) {
                        errors.push({ row, error: `Customer ${customerId} not found in branch` });
                        continue;
                    }
                }

                // Auto-detect model and manufacturer from parameters
                const { model, manufacturer } = detectMachineInfo(serialNumber.toString());

                try {
                    // Check if machine already exists (branch-scoped)
                    const existing = await tx.posMachine.findFirst({
                        where: { 
                            serialNumber: serialNumber.toString(),
                            branchId
                        }
                    });

                    if (existing) {
                        // Update the customer link AND apply parameters
                        await tx.posMachine.update({
                            where: { id: existing.id },
                            data: {
                                customerId: customerId ? customerId.toString() : null,
                                model: model || existing.model,
                                manufacturer: manufacturer || existing.manufacturer,
                                posId: posId || existing.posId
                            }
                        });
                        updatedCount++;
                    } else {
                        // Before creating customer machine, check if it exists in warehouse
                        const existsInWarehouse = await tx.warehouseMachine.findFirst({
                            where: { 
                                serialNumber: serialNumber.toString(),
                                branchId
                            }
                        });

                        if (existsInWarehouse) {
                            errors.push({ row, error: `Machine ${serialNumber} exists in warehouse, cannot assign to customer` });
                            continue;
                        }

                        // Create new machine with auto-detected model and manufacturer
                        await tx.posMachine.create({
                            data: {
                                serialNumber: serialNumber.toString(),
                                branchId,
                                customerId: customerId ? customerId.toString() : null,
                                model: model,
                                manufacturer: manufacturer,
                                posId: posId
                            }
                        });
                        successCount++;
                    }
                } catch (err) {
                    errors.push({ row, error: err.message });
                }
            }

            return { successCount, updatedCount, errors };
        });

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
        res.status(500).json({ error: 'Failed to import Machines' });
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
        res.status(500).json({ error: 'Failed to export Machines' });
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
        res.status(500).json({ error: 'Failed to fetch Machines' });
    }
});

// POST apply parameters to machines missing model/manufacturer
router.post('/machines/apply-parameters', authenticateToken, async (req, res) => {
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

        for (const machine of machinesToUpdate) {
            // Find matching parameter by prefix
            const matchingParam = machineParams.find(param =>
                machine.serialNumber.startsWith(param.prefix)
            );

            if (matchingParam) {
                await db.posMachine.update({
                    where: { id: machine.id },
                    data: {
                        model: matchingParam.model,
                        manufacturer: matchingParam.manufacturer
                    }
                });
                updatedCount++;
            }
        }

        res.json({
            success: true,
            checked: machinesToUpdate.length,
            updated: updatedCount
        });

    } catch (error) {
        console.error('Failed to apply parameters:', error);
        res.status(500).json({ error: 'Failed to apply parameters' });
    }
});

module.exports = router;
