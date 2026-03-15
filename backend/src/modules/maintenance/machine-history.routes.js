const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { success, error } = require('../../../utils/apiResponse');
const asyncHandler = require('../../../utils/asyncHandler');

// GET /api/machines/:serialNumber/history
// Get machine history (all activities for a specific machine)
router.get('/machines/:serialNumber/history', authenticateToken, asyncHandler(async (req, res) => {
    const { serialNumber } = req.params;

    // 1. Get machine info
    const machine = await db.posMachine.findFirst({
        where: { serialNumber },
        include: { customer: true }
    });

    if (!machine) {
        return error(res, '�������� ��� ������', 404);
    }

    // 2. Get all maintenance requests
    const requests = await db.maintenanceRequest.findMany({
        where: { posMachineId: machine.id },
        orderBy: { createdAt: 'desc' }
    });

    // 3. Get all payments related to this machine's requests
    const requestIds = requests.map(r => r.id);
    const payments = await db.payment.findMany({
        where: { requestId: { in: requestIds } },
        orderBy: { createdAt: 'desc' }
    });

    // 4. Get machine movement logs (exchanges, returns, etc.)
    const movements = await db.machineMovementLog.findMany({
        where: { serialNumber },
        orderBy: { createdAt: 'desc' }
    });

    // 5. Combine all into timeline
    const timeline = [];

    // Add requests
    requests.forEach(req => {
        const usedParts = req.usedParts ? JSON.parse(req.usedParts) : null;

        timeline.push({
            type: 'maintenance',
            date: req.createdAt,
            status: req.status,
            title: req.status === 'Closed' ? '��� ����� �����' : '��� �����',
            details: {
                requestId: req.id,
                complaint: req.complaint,
                action: req.actionTaken,
                technician: req.technician,
                status: req.status,
                usedParts: usedParts?.parts || [],
                totalCost: usedParts?.totalCost || 0,
                closedAt: req.closingTimestamp,
                receiptNumber: req.receiptNumber
            }
        });
    });

    // Add payments
    payments.forEach(payment => {
        timeline.push({
            type: 'payment',
            date: payment.createdAt,
            title: '���� �����',
            details: {
                amount: payment.amount,
                reason: payment.reason,
                receiptNumber: payment.receiptNumber,
                paymentPlace: payment.paymentPlace,
                requestId: payment.requestId
            }
        });
    });

    // Add movements (exchanges, transfers, etc.)
    movements.forEach(movement => {
        let title = movement.action;
        switch (movement.action) {
            case 'EXCHANGE_IN': title = '������� - ������ �����'; break;
            case 'EXCHANGE_OUT': title = '������� - ������ �����'; break;
            case 'SELL': title = '���'; break;
            case 'RETURN_FROM_CLIENT': title = '����� �� ����'; break;
            case 'IMPORT': title = '�������'; break;
            case 'STATUS_CHANGE': title = '����� ����'; break;
        }

        timeline.push({
            type: 'movement',
            date: movement.createdAt,
            title,
            details: {
                action: movement.action,
                details: movement.details,
                performedBy: movement.performedBy
            }
        });
    });

    // Sort timeline by date (newest first)
    timeline.sort((a, b) => new Date(b.date) - new Date(a.date));

    // Calculate totals
    const totalMaintenance = requests.filter(r => r.status === 'Closed').length;
    const totalCost = payments.reduce((sum, p) => sum + p.amount, 0);

    return success(res, {
        machine: {
            serialNumber: machine.serialNumber,
            model: machine.model,
            manufacturer: machine.manufacturer,
            customerId: machine.customerId,
            customerName: machine.customer?.client_name
        },
        stats: {
            totalMaintenance,
            totalCost,
            totalPayments: payments.length,
            totalMovements: movements.length
        },
        timeline
    });
}));

module.exports = router;
