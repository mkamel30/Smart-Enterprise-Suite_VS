const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { ensureBranchWhere } = require('../../../prisma/branchHelpers');
const { isGlobalRole } = require('../../../utils/constants');
const { createPaginationResponse, parsePaginationParams, createPrismaPagination } = require('../../../utils/pagination');
const { authenticateToken } = require('../../../middleware/auth');

// Middleware to restrict this route to SUPER_ADMIN only
const restrictToSuperAdmin = (req, res, next) => {
    if (req.user?.role !== 'SUPER_ADMIN') {
        return res.status(403).json({ error: 'Access restricted to system administrators' });
    }
    next();
};

router.use(authenticateToken);
router.use(restrictToSuperAdmin);

// GET all tables
router.get('/tables', async (req, res) => {
    try {
        const tables = [
            { name: 'customer', label: '�������' },
            { name: 'posMachine', label: '������� POS' },
            { name: 'simCard', label: '����� SIM' },
            { name: 'maintenanceRequest', label: '����� �������' },
            { name: 'sparePart', label: '��� ������' },
            { name: 'inventoryItem', label: '�������' },
            { name: 'user', label: '����������' },
            { name: 'payment', label: '���������' },
            { name: 'warehouseMachine', label: '���� ���������' },
            { name: 'machineSale', label: '������ ���������' },
            { name: 'systemLog', label: '��� ������' }
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

        const { limit, offset } = parsePaginationParams(req.query);
        const prismaPagination = createPrismaPagination(limit, offset);

        // For discovery tool, we use findMany which is more flexible than unique lookups
        const [records, total] = await Promise.all([
            db[tableName].findMany({
                ...prismaPagination,
                orderBy: { id: 'desc' }
            }),
            db[tableName].count()
        ]);

        res.json(createPaginationResponse(records, total, limit, offset));
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

        // Use deleteMany to avoid findUnique requirement of branchId
        const result = await db[tableName].deleteMany({
            where: { id }
        });

        if (result.count === 0) {
            return res.status(404).json({ error: 'Record not found' });
        }

        res.json({ success: true });
    } catch (error) {
        console.error(`Failed to delete record from ${req.params.tableName}:`, error);
        res.status(500).json({ error: error.message || 'Failed to delete record' });
    }
});

module.exports = router;
