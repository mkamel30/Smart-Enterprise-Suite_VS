const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { getBranchFilter } = require('../middleware/permissions');

// GET dashboard stats
router.get('/stats/dashboard', authenticateToken, async (req, res) => {
    try {
        const branchFilter = getBranchFilter(req);
        const now = new Date();

        // 1. Fetch Active Requests for KPIs
        const activeRequests = await db.maintenanceRequest.findMany({
            where: {
                ...branchFilter,
                status: { in: ['Open', 'In Progress'] }
            }
        });

        // 2. Count total machines
        const totalMachines = await db.posMachine.count({ where: branchFilter });

        // 3. Count total customers
        const totalCustomers = await db.customer.count({ where: branchFilter });

        // 4. Get requests by status
        const requestsByStatus = {
            open: activeRequests.filter(r => r.status === 'Open').length,
            inProgress: activeRequests.filter(r => r.status === 'In Progress').length,
        };

        // 5. Recent requests
        const recentRequests = await db.maintenanceRequest.findMany({
            where: branchFilter,
            take: 10,
            orderBy: { createdAt: 'desc' },
            include: {
                customer: true,
                posMachine: true
            }
        });

        res.json({
            activeRequests: activeRequests.length,
            totalMachines,
            totalCustomers,
            requestsByStatus,
            recentRequests
        });
    } catch (error) {
        console.error('Failed to fetch dashboard stats:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

module.exports = router;
