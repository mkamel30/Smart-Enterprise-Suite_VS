const express = require('express');
const router = express.Router();
const db = require('../../../../db');
const { authenticateToken } = require('../../../../middleware/auth');
const { getBranchFilter } = require('../../../../middleware/permissions');
const { success, error, paginated } = require('../../../../utils/apiResponse');
const { ROLES } = require('../../../../utils/constants');
const warehouseService = require('../warehouse.service.js');

// GET Template
router.get('/template', authenticateToken, async (req, res) => {
    try {
        const { generateTemplate } = require('../../../../utils/excel');
        const columns = [
            { header: 'Serial Number', key: 'serialNumber', width: 25 },
            { header: 'Model', key: 'model', width: 20 },
            { header: 'Manufacturer', key: 'manufacturer', width: 20 },
            { header: 'Notes', key: 'notes', width: 40 }
        ];
        const buffer = await generateTemplate(columns, 'warehouse_machines_import.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=warehouse_machines_import.xlsx');
        res.send(buffer);
    } catch (err) {
        return error(res, 'Failed to generate template');
    }
});

// POST Import
router.post('/import', authenticateToken, async (req, res) => {
    try {
        const { machines, performedBy = 'System' } = req.body;
        const branchId = req.user.branchId || req.body.branchId;
        if (!branchId) return error(res, 'Branch ID is required', 400);
        const results = await warehouseService.importMachines(machines, branchId, performedBy);
        return success(res, results);
    } catch (err) {
        return error(res, err.message || 'Import failed', err.status || 500);
    }
});

// GET Export
router.get('/export', authenticateToken, async (req, res) => {
    try {
        const { status, branchId } = req.query;
        const { exportToExcel } = require('../../../../utils/excel');
        const branchFilter = getBranchFilter(req);
        const where = { ...branchFilter };
        if (status) where.status = status;
        if (branchId) where.branchId = branchId;

        const machines = await db.warehouseMachine.findMany({
            where,
            include: { branch: { select: { name: true } } },
            orderBy: { createdAt: 'desc' }
        });

        const columns = [
            { header: 'Serial Number', key: 'serialNumber', width: 25 },
            { header: 'Model', key: 'model', width: 20 },
            { header: 'Manufacturer', key: 'manufacturer', width: 20 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Branch', key: 'branchName', width: 20 },
            { header: 'Notes', key: 'notes', width: 40 },
            { header: 'Created At', key: 'createdAt', width: 20 }
        ];

        const data = machines.map(m => ({
            serialNumber: m.serialNumber,
            model: m.model || '',
            manufacturer: m.manufacturer || '',
            status: m.status,
            branchName: m.branch?.name || '',
            notes: m.notes || '',
            createdAt: m.createdAt ? new Date(m.createdAt).toLocaleDateString('ar-EG') : ''
        }));

        const buffer = await exportToExcel(data, columns, 'warehouse_machines_export.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=warehouse_machines_${status || 'all'}_${new Date().toISOString().slice(0, 10)}.xlsx`);
        res.send(buffer);
    } catch (err) {
        return error(res, 'Failed to export');
    }
});

module.exports = router;
