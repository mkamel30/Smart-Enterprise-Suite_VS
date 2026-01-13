const express = require('express');
const router = express.Router();
const multer = require('multer');
const { z } = require('zod');
const ExcelJS = require('exceljs');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest, validateQuery } = require('../middleware/validation');
const transferService = require('../services/transferService');

const upload = multer({ storage: multer.memoryStorage() });

// Validation Schemas
const listQuerySchema = z.object({
    branchId: z.string().regex(/^[a-z0-9]{25}$/).optional(),
    status: z.enum(['PENDING', 'APPROVED', 'REJECTED', 'COMPLETED', 'CANCELLED']).optional(),
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

// Get all transfer orders
router.get('/', authenticateToken, validateQuery(listQuerySchema), async (req, res) => {
    try {
        const orders = await transferService.listTransferOrders(req.query, req.user);
        res.json(orders);
    } catch (error) {
        console.error('Failed to fetch transfer orders:', error);
        res.status(500).json({ error: 'فشل في جلب الأذونات' });
    }
});

// Get pending orders for a branch
router.get('/pending', authenticateToken, async (req, res) => {
    try {
        const orders = await transferService.getPendingOrders({
            branchId: req.query.branchId,
            type: req.query.type
        }, req.user, req);
        res.json(orders);
    } catch (error) {
        console.error('Failed to fetch pending orders:', error);
        res.status(500).json({ error: 'فشل في جلب الأذونات المعلقة' });
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
        res.json(serials);
    } catch (error) {
        console.error('Failed to fetch pending serials:', error);
        res.status(500).json({ error: 'فشل في جلب الماكينات قيد التحويل' });
    }
});

// Get stats/reports
router.get('/stats/summary', authenticateToken, async (req, res) => {
    try {
        const stats = await transferService.getStatsSummary({ branchId: req.query.branchId, fromDate: req.query.fromDate, toDate: req.query.toDate }, req.user);
        res.json(stats);
    } catch (error) {
        console.error('Failed to get stats:', error);
        res.status(500).json({ error: 'فشل في جلب الإحصائيات' });
    }
});

/**
 * GET Export Transfer Orders to Excel
 */
const { exportToExcel } = require('../utils/excel');
router.get('/export-data', authenticateToken, async (req, res) => {
    try {
        const orders = await transferService.listTransferOrders(req.query, req.user);

        const data = orders.map(o => ({
            'التاريخ': new Date(o.createdAt).toLocaleDateString('ar-EG'),
            'رقم الإذن': o.orderNumber || o.id.slice(0, 8),
            'النوع': o.type === 'MACHINE' ? 'ماكينات' : o.type === 'SIM' ? 'شرائح' : 'قطع غيار',
            'من الفرع': o.fromBranch?.name || '-',
            'إلى الفرع': o.toBranch?.name || '-',
            'عدد العناصر': o.items?.length || 0,
            'الحالة': o.status === 'PENDING' ? 'معلق' : o.status === 'COMPLETED' ? 'مكتمل' : o.status === 'CANCELLED' ? 'ملغي' : o.status,
            'ملاحظات': o.notes || '-'
        }));

        const columns = [
            { header: 'التاريخ', key: 'التاريخ', width: 15 },
            { header: 'رقم الإذن', key: 'رقم الإذن', width: 15 },
            { header: 'النوع', key: 'النوع', width: 12 },
            { header: 'من الفرع', key: 'من الفرع', width: 20 },
            { header: 'إلى الفرع', key: 'إلى الفرع', width: 20 },
            { header: 'عدد العناصر', key: 'عدد العناصر', width: 12 },
            { header: 'الحالة', key: 'الحالة', width: 12 },
            { header: 'ملاحظات', key: 'ملاحظات', width: 30 }
        ];

        const buffer = await exportToExcel(data, columns, 'transfer_orders_export');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', 'attachment; filename=transfer_orders_export.xlsx');
        res.send(buffer);
    } catch (error) {
        console.error('Failed to export transfer orders:', error);
        res.status(500).json({ error: 'فشل في تصدير أذونات الصرف' });
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
    } catch (error) {
        console.error('Failed to generate template:', error);
        res.status(500).json({ error: 'فشل في إنشاء القالب' });
    }
});

// Get single order
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const order = await transferService.getTransferOrderById(req.params.id, req.user);
        res.json(order);
    } catch (error) {
        console.error('Failed to fetch transfer order:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في جلب الإذن' });
    }
});

// Create transfer order
router.post('/', authenticateToken, validateRequest(createOrderSchema), async (req, res) => {
    try {
        const order = await transferService.createTransferOrder(req.body, req.user);
        res.status(201).json(order);
    } catch (error) {
        console.error('========== TRANSFER ORDER ERROR ==========', error.message);
        res.status(error.status || 500).json({ error: error.message || 'فشل في إنشاء الإذن' });
    }
});

// Import items from Excel
router.post('/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'ملف مطلوب' });
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
        res.status(201).json(result);
    } catch (error) {
        console.error('Failed to import transfer order:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في استيراد الإذن' });
    }
});



// Receive order (confirm receipt)
router.post('/:id/receive', authenticateToken, validateRequest(receiveOrderSchema), async (req, res) => {
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
        res.json(updated);
    } catch (error) {
        console.error('Failed to receive order:', error.message || error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في تأكيد الاستلام' });
    }
});

// Reject order
router.post('/:id/reject', authenticateToken, validateRequest(rejectOrderSchema), async (req, res) => {
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
        res.json(updated);
    } catch (error) {
        console.error('Reject order error:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في رفض الإذن' });
    }
});

// Cancel order
router.post('/:id/cancel', authenticateToken, async (req, res) => {
    try {
        const result = await transferService.cancelOrder(req.params.id, req.user);
        res.json(result);
    } catch (error) {
        console.error('Failed to cancel order:', error);
        res.status(error.status || 500).json({ error: error.message || 'فشل في إلغاء الإذن' });
    }
});



module.exports = router;
