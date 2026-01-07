const express = require('express');
const router = express.Router();
const db = require('../db');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// GET all tables
router.get('/tables', async (req, res) => {
    try {
        const tables = [
            { name: 'customer', label: 'العملاء' },
            { name: 'posMachine', label: 'ماكينات POS' },
            { name: 'simCard', label: 'شرائح SIM' },
            { name: 'maintenanceRequest', label: 'طلبات الصيانة' },
            { name: 'sparePart', label: 'قطع الغيار' },
            { name: 'inventoryItem', label: 'المخزون' },
            { name: 'user', label: 'المستخدمين' },
            { name: 'payment', label: 'المدفوعات' },
            { name: 'warehouseMachine', label: 'مخزن الماكينات' },
            { name: 'machineSale', label: 'مبيعات الماكينات' },
            { name: 'systemLog', label: 'سجل النظام' }
        ];
        res.json(tables);
    } catch (error) {
        console.error('Failed to fetch tables:', error);
        res.status(500).json({ error: 'Failed to fetch tables' });
    }
});

// GET records from a table
router.get('/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;

        if (!db[tableName]) {
            return res.status(404).json({ error: 'Table not found' });
        }

        const records = await db[tableName].findMany(ensureBranchWhere({
            take: 100, // Limit to 100 records
            orderBy: { id: 'desc' }
        }, req));

        res.json(records);
    } catch (error) {
        console.error(`Failed to fetch records from ${req.params.tableName}:`, error);
        res.status(500).json({ error: 'Failed to fetch records' });
    }
});

// POST create record
router.post('/:tableName', async (req, res) => {
    try {
        const { tableName } = req.params;

        if (!db[tableName]) {
            return res.status(404).json({ error: 'Table not found' });
        }

        const record = await db[tableName].create({
            data: req.body
        });

        res.status(201).json(record);
    } catch (error) {
        console.error(`Failed to create record in ${req.params.tableName}:`, error);
        res.status(500).json({ error: error.message || 'Failed to create record' });
    }
});

// DELETE record
router.delete('/:tableName/:id', async (req, res) => {
    try {
        const { tableName, id } = req.params;

        if (!db[tableName]) {
            return res.status(404).json({ error: 'Table not found' });
        }

        // Fetch first to validate existence and branch
        const record = await db[tableName].findUnique({ where: { id } });
        
        if (!record) {
            return res.status(404).json({ error: 'Record not found' });
        }
        
        // Authorization check if record has branchId
        if (record.branchId && req.user?.branchId) {
            const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user?.role);
            if (!isAdmin && record.branchId !== req.user.branchId) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }
        
        await db[tableName].delete({ where: { id } });

        res.json({ success: true });
    } catch (error) {
        console.error(`Failed to delete record from ${req.params.tableName}:`, error);
        res.status(500).json({ error: error.message || 'Failed to delete record' });
    }
});

module.exports = router;
