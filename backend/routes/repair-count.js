const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// GET monthly repair count for a machine
router.get('/requests/machine/:serialNumber/monthly-count', authenticateToken, async (req, res) => {
    try {
        const { serialNumber } = req.params;

        // Get start of current month
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

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
            const isAdmin = ['SUPER_ADMIN', 'MANAGEMENT'].includes(req.user.role);
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
                    gte: startOfMonth
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
