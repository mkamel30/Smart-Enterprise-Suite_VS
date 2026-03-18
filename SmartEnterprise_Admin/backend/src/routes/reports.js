const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { adminAuth } = require('../middleware/auth');

router.use(adminAuth);

// Consolidated Financial Overview
router.get('/financial-summary', async (req, res) => {
    try {
        const branches = await prisma.branch.findMany({
            include: {
                payments: true,
                _count: {
                    select: {
                        requests: true,
                        users: true,
                        customers: true,
                        posMachines: true,
                        inventory: true
                    }
                }
            }
        });

        const summary = branches.map(b => {
             const totalRevenue = b.payments.reduce((sum, p) => sum + p.amount, 0);
             return {
                 branchId: b.id,
                 branchName: b.name,
                 revenue: totalRevenue,
                 requestCount: b._count.requests,
                 userCount: b._count.users,
                 customerCount: b._count.customers,
                 machineCount: b._count.posMachines,
                 stockCount: b._count.inventory
             };
        });

        // Group by Date for enterprise-wide revenue chart (Last 30 days)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

        const dailyRevenue = await prisma.payment.groupBy({
            by: ['createdAt'],
            _sum: {
                amount: true
            },
            where: {
                createdAt: {
                    gte: thirtyDaysAgo
                }
            }
        });

        res.json({
            branchBreakdown: summary,
            dailyRevenue,
            totalEnterpriseRevenue: summary.reduce((sum, b) => sum + b.revenue, 0)
        });
    } catch (error) {
        console.error('Financial summary failed:', error);
        res.status(500).json({ error: 'Failed to fetch financial summary' });
    }
});

module.exports = router;
