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
            { name: 'customer', label: 'ط§ظ„ط¹ظ…ظ„ط§ط،' },
            { name: 'posMachine', label: 'ظ…ط§ظƒظٹظ†ط§طھ POS' },
            { name: 'simCard', label: 'ط´ط±ط§ط¦ط­ SIM' },
            { name: 'maintenanceRequest', label: 'ط·ظ„ط¨ط§طھ ط§ظ„طµظٹط§ظ†ط©' },
            { name: 'sparePart', label: 'ظ‚ط·ط¹ ط§ظ„ط؛ظٹط§ط±' },
            { name: 'inventoryItem', label: 'ط§ظ„ظ…ط®ط²ظˆظ†' },
            { name: 'user', label: 'ط§ظ„ظ…ط³طھط®ط¯ظ…ظٹظ†' },
            { name: 'payment', label: 'ط§ظ„ظ…ط¯ظپظˆط¹ط§طھ' },
            { name: 'warehouseMachine', label: 'ظ…ط®ط²ظ† ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ' },
            { name: 'machineSale', label: 'ظ…ط¨ظٹط¹ط§طھ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ' },
            { name: 'systemLog', label: 'ط³ط¬ظ„ ط§ظ„ظ†ط¸ط§ظ…' }
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
