const express = require('express');
const router = express.Router();
const multer = require('multer');
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { createNotification } = require('./notifications');
const { detectMachineParams } = require('../utils/machine-validation');
const { getBranchFilter, canAccessBranch } = require('../utils/auth-helpers');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const movementService = require('../services/movementService');
const transferService = require('../services/transferService');

const upload = multer({ storage: multer.memoryStorage() });

// Routes for transfer orders are largely handled by the transferService.
// This file serves as the main entry point for transfer-related API endpoints.

// Get all transfer orders
router.get('/', authenticateToken, async (req, res) => {
    try {
        const orders = await transferService.listTransferOrders({ branchId: req.query.branchId, status: req.query.status, type: req.query.type, fromDate: req.query.fromDate, toDate: req.query.toDate, q: req.query.q }, req.user);
        res.json(orders);
    } catch (error) {
        console.error('Failed to fetch transfer orders:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط£ط°ظˆظ†ط§طھ' });
    }
});

// Get pending orders for a branch
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const orders = await transferService.getPendingOrders({ branchId: req.query.branchId, type: req.query.type }, req.user, req);
        res.json(orders);
    } catch (error) {
        console.error('Failed to fetch pending orders:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط£ط°ظˆظ†ط§طھ ط§ظ„ظ…ط¹ظ„ظ‚ط©' });
    }
});

// Get serial numbers in pending transfers (for validation)
// IMPORTANT: This route MUST be before /:id to avoid matching "pending-serials" as an ID
router.get('/pending-serials', authenticateToken, async (req, res) => {
    try {
        const serials = await transferService.getPendingSerials({ branchId: req.query.branchId, type: req.query.type }, req.user);
        res.json(serials);
    } catch (error) {
        console.error('Failed to fetch pending serials:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ظ‚ظٹط¯ ط§ظ„طھط­ظˆظٹظ„' });
    }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await transferService.getTransferOrderById(req.params.id, req.user);
        res.json(order);
    } catch (error) {
        console.error('Failed to fetch transfer order:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط¥ط°ظ†' });
    }
});

// Create transfer order
router.post('/', authenticateToken, async (req, res) => {
    try {
        const order = await transferService.createTransferOrder(req.body, req.user);
        res.status(201).json(order);
    } catch (error) {
        console.error('========== TRANSFER ORDER ERROR ==========', error.message);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط¥ظ†ط´ط§ط، ط§ظ„ط¥ط°ظ†' });
    }
});

// Import items from Excel
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        const result = await transferService.importTransferFromExcel(req.file?.buffer, { branchId: req.body.branchId, type: req.body.type, createdBy: req.body.createdBy, createdByName: req.body.createdByName, notes: req.body.notes }, req.user);
        res.status(201).json(result);
    } catch (error) {
        console.error('Failed to import transfer order:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط§ط³طھظٹط±ط§ط¯ ط§ظ„ط¥ط°ظ†' });
    }
});

// Download template
router.get('/template/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;

        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Template');

        if (type === 'SIM') {
            worksheet.columns = [
                { header: 'Serial Number', key: 'serialNumber', width: 25 },
                { header: 'Type (Vodafone/Orange/Etisalat/WE)', key: 'type', width: 30 },
                { header: 'Notes', key: 'notes', width: 30 }
            ];
        } else if (type === 'MACHINE') {
            worksheet.columns = [
                { header: 'Serial Number', key: 'serialNumber', width: 25 },
                { header: 'Model (auto-detected)', key: 'type', width: 25 },
                { header: 'Manufacturer (auto-detected)', key: 'manufacturer', width: 25 },
                { header: 'Notes', key: 'notes', width: 30 }
            ];
        } else {
            worksheet.columns = [
                { header: 'Serial/Code', key: 'serialNumber', width: 25 },
                { header: 'Type', key: 'type', width: 25 },
                { header: 'Notes', key: 'notes', width: 30 }
            ];
        }

        // Style header
        worksheet.getRow(1).font = { bold: true };
        worksheet.getRow(1).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFE0E0E0' }
        };

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=transfer_order_${type.toLowerCase()}_import.xlsx`);

        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        console.error('Failed to generate template:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¥ظ†ط´ط§ط، ط§ظ„ظ‚ط§ظ„ط¨' });
    }
});

// Receive order (confirm receipt)
router.post('/:id/receive', authenticateToken, async (req, res) => {
    try {
        const { receivedBy, receivedByName, receivedItems } = req.body;
        const updated = await transferService.receiveTransferOrder(req.params.id, { receivedBy, receivedByName, receivedItems }, req.user);
        res.json(updated);
    } catch (error) {
        console.error('Failed to receive order:', error.message || error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ طھط£ظƒظٹط¯ ط§ظ„ط§ط³طھظ„ط§ظ…' });
    }
});

// Reject order
router.post('/:id/reject', authenticateToken, async (req, res) => {
    try {
        const updated = await transferService.rejectOrder(req.params.id, { rejectionReason: req.body.rejectionReason, receivedBy: req.body.receivedBy, receivedByName: req.body.receivedByName }, req.user);
        res.json(updated);
    } catch (error) {
        console.error('Failed to reject order:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط±ظپط¶ ط§ظ„ط¥ط°ظ†' });
    }
});

// Cancel order
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await transferService.cancelOrder(req.params.id, req.user);
        res.json(result);
    } catch (error) {
        console.error('Failed to cancel order:', error);
        res.status(error.status || 500).json({ error: error.message || 'ظپط´ظ„ ظپظٹ ط¥ظ„ط؛ط§ط، ط§ظ„ط¥ط°ظ†' });
    }
});

// Get stats/reports
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const stats = await transferService.getStatsSummary({ branchId: req.query.branchId, fromDate: req.query.fromDate, toDate: req.query.toDate }, req.user);
        res.json(stats);
    } catch (error) {
        console.error('Failed to get stats:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ط¥ط­طµط§ط¦ظٹط§طھ' });
    }
});

module.exports = router;
