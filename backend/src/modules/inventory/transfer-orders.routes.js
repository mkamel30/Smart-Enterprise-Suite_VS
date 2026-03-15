const express = require('express');
const router = express.Router();
const multer = require('multer');
const { z } = require('zod');
const ExcelJS = require('exceljs');
const { authenticateToken } = require('../../../middleware/auth');
const { validateRequest, validateQuery } = require('../../../middleware/validation');
const { requirePermission, PERMISSIONS } = require('../../../middleware/permissions');
const transferService = require('./transfer.service.js');
const { success, error, paginated } = require('../../../utils/apiResponse');
const { TRANSFER_STATUS, ROLES } = require('../../../utils/constants');
const { exportEntitiesToExcel, transformTransfersForExport, setExcelHeaders, generateExportFilename } = require('../../../utils/excel');

const upload = multer({ storage: multer.memoryStorage() });

// Validation Schemas
const listQuerySchema = z.object({
    branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
    status: z.enum(Object.values(TRANSFER_STATUS)).optional(),
    type: z.enum(['MACHINE', 'SIM', 'SPARE_PART']).optional(),
    fromDate: z.string().datetime().optional(),
    toDate: z.string().datetime().optional(),
    q: z.string().optional()
});

const createOrderSchema = z.object({
    type: z.enum(['MACHINE', 'SIM', 'SPARE_PART']),
    fromBranchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
    toBranchId: z.string().regex(/^[a-z0-9]{25}$/),
    items: z.array(z.object({
        serialNumber: z.string().min(1).optional(), // For Machine/SIM
        partId: z.string().min(1).optional(), // For Spare Parts
        quantity: z.number().int().positive().optional().default(1)
    })).min(1),
    notes: z.string().optional()
});

const receiveOrderSchema = z.object({
    receivedItems: z.array(z.object({
        serialNumber: z.string().optional(),
        partId: z.string().optional(),
        accepted: z.boolean(),
        notes: z.string().optional()
    })).optional()
});

const rejectOrderSchema = z.object({
    rejectionReason: z.string().min(5, 'سبب الرفض مطلوب (5 أحرف على الأقل)')
});

// Routes for transfer orders are largely handled by the transferService.
// This file serves as the main entry point for transfer-related API endpoints.

// Get all transfer orders - PAGINATED
router.get('/', authenticateToken, validateQuery(listQuerySchema), async (req, res) => {
    try {
        const limit = parseInt(req.query.limit) || 50;
        const offset = parseInt(req.query.offset) || 0;
        const { items, total } = await transferService.listTransferOrders({ ...req.query, limit, offset }, req.user);
        return paginated(res, items, total, limit, offset);
    } catch (err) {
        console.error('Failed to fetch transfer orders:', err);
        return error(res, 'فشل في جلب الأذونات');
    }
});

// Get pending orders for a branch
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const orders = await transferService.getPendingOrders({
            branchId: req.query.branchId,
            type: req.query.type
        }, req.user, req);
        return success(res, orders);
    } catch (err) {
        console.error('Failed to fetch pending orders:', err);
        return error(res, 'فشل في جلب الأذونات المعلقة');
    }
});

// Get serial numbers in pending transfers (for validation)
// IMPORTANT: This route MUST be before /:id to avoid matching "pending-serials" as an ID
router.get('/pending-serials', authenticateToken, async (req, res) => {
    try {
        const serials = await transferService.getPendingSerials({
            branchId: req.query.branchId,
            type: req.query.type
        }, req.user);
        return success(res, serials);
    } catch (err) {
        console.error('Failed to fetch pending serials:', err);
        return error(res, 'فشل في جلب الماكينات قيد التحويل');
    }
});

// Get stats/reports
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const stats = await transferService.getStatsSummary({ branchId: req.query.branchId, fromDate: req.query.fromDate, toDate: req.query.toDate }, req.user);
        return success(res, stats);
    } catch (err) {
        console.error('Failed to get stats:', err);
        return error(res, 'فشل في جلب الإحصائيات');
    }
});

/**
 * GET Export Transfer Orders to Excel
 */
router.get('/export-data', authenticateToken, async (req, res) => {
    try {
        const { items: orders } = await transferService.listTransferOrders(req.query, req.user);

        const data = transformTransfersForExport(orders);
        const buffer = await exportEntitiesToExcel(data, 'transfers', 'transfer_orders_export');

        setExcelHeaders(res, generateExportFilename('transfer_orders_export'));
        res.send(buffer);
    } catch (err) {
        console.error('Failed to export transfer orders:', err);
        return error(res, 'فشل في تصدير أذونات الصرف');
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
                { header: 'Type', key: 'type', width: 30 },
                { header: 'Notes', key: 'notes', width: 30 }
            ];
        } else if (type === 'MACHINE') {
            worksheet.columns = [
                { header: 'Serial Number', key: 'serialNumber', width: 25 },
                { header: 'Notes', key: 'notes', width: 30 }
            ];
        } else {
            // Shared/Spare Parts
            worksheet.columns = [
                { header: 'Part Code', key: 'serialNumber', width: 25 },
                { header: 'Quantity', key: 'quantity', width: 15 },
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
    } catch (err) {
        console.error('Failed to generate template:', err);
        return error(res, 'فشل في إنشاء القالب');
    }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await transferService.getTransferOrderById(req.params.id, req.user);
        return success(res, order);
    } catch (err) {
        console.error('Failed to fetch transfer order:', err);
        return error(res, err.message || 'فشل في جلب الإذن', err.status || 500);
    }
});

// Create transfer order
router.post('/', authenticateToken, validateRequest(createOrderSchema), async (req, res) => {
    try {
        const order = await transferService.createTransferOrder(req.body, req.user);
        return success(res, order, 201);
    } catch (err) {
        console.error('========== TRANSFER ORDER ERROR ==========', err.message);
        return error(res, err.message || 'فشل في إنشاء الإذن', err.status || 500);
    }
});

// Import items from Excel
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return error(res, 'ملف مطلوب', 400);
        }
        const result = await transferService.importTransferFromExcel(
            req.file.buffer,
            {
                branchId: req.body.branchId,
                type: req.body.type,
                notes: req.body.notes
            },
            req.user
        );
        return success(res, result, 201);
    } catch (err) {
        console.error('Failed to import transfer order:', err);
        return error(res, err.message || 'فشل في استيراد الإذن', err.status || 500);
    }
});



// Receive order (confirm receipt)
router.post('/:id/receive', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_RECEIVE), validateRequest(receiveOrderSchema), async (req, res) => {
    try {
        const updated = await transferService.receiveTransferOrder(
            req.params.id,
            {
                receivedBy: req.user.id,
                receivedByName: req.user.displayName,
                receivedItems: req.body.receivedItems
            },
            req.user
        );
        return success(res, updated);
    } catch (err) {
        console.error('Failed to receive order:', err.message || err);
        return error(res, err.message || 'فشل في تأكيد الاستلام', err.status || 500);
    }
});

// Reject order
router.post('/:id/reject', authenticateToken, requirePermission(PERMISSIONS.INVENTORY_RECEIVE), validateRequest(rejectOrderSchema), async (req, res) => {
    try {
        const updated = await transferService.rejectOrder(
            req.params.id,
            {
                rejectionReason: req.body.rejectionReason,
                receivedBy: req.user.id,
                receivedByName: req.user.displayName
            },
            req.user
        );
        return success(res, updated);
    } catch (err) {
        console.error('Reject order error:', err);
        return error(res, err.message || 'فشل في رفض الإذن', err.status || 500);
    }
});

// Cancel order
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await transferService.cancelOrder(req.params.id, req.user);
        return success(res, result);
    } catch (err) {
        console.error('Failed to cancel order:', err);
        return error(res, err.message || 'فشل في إلغاء الإذن', err.status || 500);
    }
});



module.exports = router;
