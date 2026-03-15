const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { isGlobalRole } = require('../utils/constants');

// GET monthly repair count for a machine
router.get('/requests/machine/:serialNumber/monthly-count', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.params;
        const dateParam = req.query.date ? new Date(req.query.date) : new Date();

        if (isNaN(dateParam.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // 1. Find the POS machine - MUST include branchId
        const machine = await db.posMachine.findFirst({
            where: { serialNumber, branchId: req.user.branchId || { not: null } },
            include: { customer: true }
        });

        if (!machine) {
            return res.json({ count: 0 });
        }

        // Authorization: check branch access if needed (findFirst already filters, but double check)
        if (req.user.branchId && machine.branchId && machine.branchId !== req.user.branchId) {
            if (!isGlobalRole(req.user.role)) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Calculate start and end of the month
        const startOfMonth = new Date(dateParam.getFullYear(), dateParam.getMonth(), 1);
        const startOfNextMonth = new Date(dateParam.getFullYear(), dateParam.getMonth() + 1, 1);

        // 2. Count closed requests - MUST include branchId
        const count = await db.maintenanceRequest.count({
            where: {
                posMachineId: machine.id,
                branchId: machine.branchId,
                status: 'Closed',
                closingTimestamp: {
                    gte: startOfMonth,
                    lt: startOfNextMonth
                }
            }
        });

        res.json({ count });
    } catch (error) {
        console.error('Failed to fetch monthly repair count:', error);
        res.status(500).json({ error: 'Failed to fetch monthly repair count' });
    }
});

module.exports = router;
