const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

// Get Global Dashboard Stats (Aggregated)
router.get('/stats', async (req, res) => {
    try {
        const [
            usersCount, 
            branchesCount, 
            totalMachines, 
            requestsCount
        ] = await Promise.all([
            prisma.user.count(),
            prisma.branch.count(),
            prisma.posMachine.count(),
            prisma.maintenanceRequest.count({ where: { status: 'Open' } })
        ]);
        const branchesWithPayments = await prisma.branch.findMany({
            include: { 
                _count: { select: { requests: true } },
                payments: {
                    select: { amount: true }
                }
            }
        });

        // Calculate performance from actual DB data (no mock-up)
        const performanceData = branchesWithPayments.map(b => ({
            name: b.name,
            revenue: b.payments.reduce((sum, p) => sum + p.amount, 0),
            repairs: b._count.requests
        }));

        res.json({
            usersCount,
            branchesCount,
            totalMachines,
            dailyOps: requestsCount,
            systemHealth: 98,
            performanceData,
            recentActions: [
                { id: 1, action: 'Global Sync Completed', branch: 'System', time: 'Just Now' },
                { id: 2, action: 'Central Security Scan', branch: 'Security', time: '5m Ago' }
            ]
        });
    } catch (error) {
        console.error('Dashboard stats failed:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

module.exports = router;
