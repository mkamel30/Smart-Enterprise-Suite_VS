const express = require('express');
const router = express.Router();
const db = require('../../db');
const { authenticateToken } = require('../../middleware/auth');
const { getBranchFilter } = require('../../middleware/permissions');
const { success, error, paginated } = require('../../utils/apiResponse');
const { ROLES } = require('../../utils/constants');
const { ensureBranchWhere } = require('../../prisma/branchHelpers');

const asyncHandler = (fn) => (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
};

// GET Template
router.get('/template', authenticateToken, asyncHandler(async (req, res) => {
    const { generateTemplate } = require('../../utils/excel');
    const columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 25 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Network Type', key: 'networkType', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Notes', key: 'notes', width: 40 }
    ];
    const buffer = await generateTemplate(columns, 'warehouse_sims_import.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=warehouse_sims_import.xlsx');
    res.send(buffer);
}));

// POST Import
router.post('/import', authenticateToken, asyncHandler(async (req, res) => {
    const { sims, performedBy = 'System' } = req.body;
    const branchId = req.user.branchId || req.body.branchId;
    if (!branchId) return res.status(400).json({ error: 'Branch ID required' });

    const results = { imported: 0, skipped: 0, errors: [] };
    for (const s of sims) {
        try {
            const existing = await db.warehouseSim.findFirst({ where: { serialNumber: s.serialNumber } });
            if (existing) { results.skipped++; continue; }
            await db.warehouseSim.create({
                data: {
                    branchId,
                    serialNumber: s.serialNumber,
                    type: s.type,
                    networkType: s.networkType || null,
                    status: s.status || 'ACTIVE',
                    notes: s.notes
                }
            });
            results.imported++;
        } catch (e) {
            results.errors.push({ serialNumber: s.serialNumber, error: e.message });
        }
    }
    return success(res, results);
}));

// GET Export
router.get('/export', authenticateToken, asyncHandler(async (req, res) => {
    const { status, type, branchId } = req.query;
    const { exportToExcel } = require('../../utils/excel');
    const branchFilter = getBranchFilter(req);
    const where = { ...branchFilter };
    if (status) where.status = status;
    if (type) where.type = type;
    if (branchId) where.branchId = branchId;

    const sims = await db.warehouseSim.findMany({
        where, include: { branch: true }, orderBy: { createdAt: 'desc' }
    });

    const columns = [
        { header: 'Serial Number', key: 'serialNumber', width: 25 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Network Type', key: 'networkType', width: 15 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Branch', key: 'branchName', width: 20 },
        { header: 'Notes', key: 'notes', width: 40 }
    ];

    const data = sims.map(s => ({
        serialNumber: s.serialNumber,
        type: s.type || '',
        networkType: s.networkType || '',
        status: s.status,
        branchName: s.branch?.name || '',
        notes: s.notes || ''
    }));

    const buffer = await exportToExcel(data, columns, 'warehouse_sims_export.xlsx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.header('Content-Disposition', `attachment; filename=warehouse_sims_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.send(buffer);
}));

module.exports = router;
