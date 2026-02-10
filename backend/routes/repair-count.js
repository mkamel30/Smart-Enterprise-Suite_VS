const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
const { isGlobalRole } = require('../utils/constants');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// GET monthly repair count for a machine
router.get('/requests/machine/:serialNumber/monthly-count', authenticateToken, async (req, res) => {
    try {
        // Get date from query or default to now
        const { serialNumber } = req.params;
        const dateParam = req.query.date ? new Date(req.query.date) : new Date();

        if (isNaN(dateParam.getTime())) {
            return res.status(400).json({ error: 'Invalid date format' });
        }

        // Calculate start and end of the month
        const startOfMonth = new Date(dateParam.getFullYear(), dateParam.getMonth(), 1);
        const startOfNextMonth = new Date(dateParam.getFullYear(), dateParam.getMonth() + 1, 1);

        // Find the POS machine
        const machine = await db.posMachine.findUnique({
            where: { serialNumber },
            include: { customer: true }
        });

        if (!machine) {
            return res.json({ count: 0 });
        }

        // Authorization: check branch access
        if (req.user.branchId && machine.customer?.branchId && machine.customer.branchId !== req.user.branchId) {
            const isAdmin = isGlobalRole(req.user.role);
            if (!isAdmin) {
                return res.status(403).json({ error: 'Access denied' });
            }
        }

        // Count closed requests for this machine this month
        const count = await db.maintenanceRequest.count({
            where: {
                posMachineId: machine.id,
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
