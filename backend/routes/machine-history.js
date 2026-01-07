const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// GET machine history (all activities for a specific machine)
router.get('/machines/:serialNumber/history', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.params;

        // 1. Get machine info
        const machine = await db.posMachine.findUnique(ensureBranchWhere({
            where: { serialNumber },
            include: { customer: true }
        }, req));

        if (!machine) {
            return res.status(404).json({ error: 'Machine not found' });
        }

        // 2. Get all maintenance requests
        const requests = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: { posMachineId: machine.id },
            orderBy: { createdAt: 'desc' }
        }, req));

        // 3. Get all payments related to this machine's requests
        const requestIds = requests.map(r => r.id);
        const payments = await db.payment.findMany(ensureBranchWhere({
            where: { requestId: { in: requestIds } },
            orderBy: { createdAt: 'desc' }
        }, req));

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
                title: req.status === 'Closed' ? 'ط·ظ„ط¨ طµظٹط§ظ†ط© ظ…ظƒطھظ…ظ„' : 'ط·ظ„ط¨ طµظٹط§ظ†ط©',
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
                title: 'ط¯ظپط¹ط© ظ…ط§ظ„ظٹط©',
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
                case 'EXCHANGE_IN': title = 'ط§ط³طھط¨ط¯ط§ظ„ - ظ…ط§ظƒظٹظ†ط© ط¬ط¯ظٹط¯ط©'; break;
                case 'EXCHANGE_OUT': title = 'ط§ط³طھط¨ط¯ط§ظ„ - ظ…ط§ظƒظٹظ†ط© ظ‚ط¯ظٹظ…ط©'; break;
                case 'SELL': title = 'ط¨ظٹط¹'; break;
                case 'RETURN_FROM_CLIENT': title = 'ط¥ط±ط¬ط§ط¹ ظ…ظ† ط¹ظ…ظٹظ„'; break;
                case 'IMPORT': title = 'ط§ط³طھظٹط±ط§ط¯'; break;
                case 'STATUS_CHANGE': title = 'طھط؛ظٹظٹط± ط­ط§ظ„ط©'; break;
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

        res.json({
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

    } catch (error) {
        console.error('Failed to fetch machine history:', error);
        res.status(500).json({ error: 'Failed to fetch machine history' });
    }
});

module.exports = router;
