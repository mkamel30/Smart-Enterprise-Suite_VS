const express = require('express');
const router = express.Router();
const prisma = require('../../db');
const { adminAuth } = require('../../middleware/auth');

router.use(adminAuth);

// GET all sync queues with optional branch filtering
router.get('/', async (req, res) => {
    try {
        const { branchId, status } = req.query;
        
        const where = {};
        if (branchId) where.branchId = branchId;
        if (status) where.status = status;

        const queues = await prisma.syncQueue.findMany({
            where,
            include: {
                branch: {
                    select: { name: true, code: true }
                }
            },
            orderBy: { createdAt: 'desc' },
            take: 100 // Limit to recent 100 for performance
        });

        // Get aggregate stats
        const stats = await prisma.syncQueue.groupBy({
            by: ['status'],
            _count: { id: true }
        });

        const summary = {
            total: 0,
            pending: 0,
            synced: 0,
            error: 0
        };

        stats.forEach(stat => {
            summary.total += stat._count.id;
            if (stat.status === 'PENDING') summary.pending = stat._count.id;
            else if (stat.status === 'SYNCED') summary.synced = stat._count.id;
            else if (stat.status === 'ERROR') summary.error = stat._count.id;
        });

        res.json({ data: queues, summary });
    } catch (error) {
        console.error('Failed to fetch sync queue:', error);
        res.status(500).json({ error: 'Failed to fetch sync queue' });
    }
});

module.exports = router;
