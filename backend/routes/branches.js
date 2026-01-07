const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// Get all branches
router.get('/', authenticateToken, async (req, res) => {
    try {
        const branches = await db.branch.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                _count: {
                    select: {
                        users: true,
                        customers: true,
                        requests: true
                    }
                }
            }
        });
        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch branches:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظپط±ظˆط¹' });
    }
});

// Get active branches only (all branches for now)
router.get('/active', authenticateToken, async (req, res) => {
    try {
        const branches = await db.branch.findMany({
            orderBy: { name: 'asc' }
        });
        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch active branches:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظپط±ظˆط¹' });
    }
});

// Get single branch
router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const branch = await db.branch.findUnique({
            where: { id: req.params.id },
            include: {
                sentTransfers: {
                    take: 10,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        if (!branch) {
            return res.status(404).json({ error: 'ط§ظ„ظپط±ط¹ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }
        res.json(branch);
    } catch (error) {
        console.error('Failed to fetch branch:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظپط±ط¹' });
    }
});

// Create branch
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { code, name, address, type, maintenanceCenterId, isActive } = req.body;

        if (!code || !name) {
            return res.status(400).json({ error: 'ط§ظ„ظƒظˆط¯ ظˆط§ظ„ط§ط³ظ… ظ…ط·ظ„ظˆط¨ط§ظ†' });
        }

        // Check for duplicate code
        const existing = await db.branch.findUnique({
            where: { code }
        });
        if (existing) {
            return res.status(400).json({ error: 'ظƒظˆط¯ ط§ظ„ظپط±ط¹ ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ط§ظ‹' });
        }

        // Validate maintenanceCenterId if provided
        if (maintenanceCenterId) {
            const center = await db.branch.findUnique({
                where: { id: maintenanceCenterId }
            });
            if (!center || center.type !== 'MAINTENANCE_CENTER') {
                return res.status(400).json({ error: 'ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط© ط؛ظٹط± طµط§ظ„ط­' });
            }
        }

        const branch = await db.branch.create({
            data: {
                code,
                name,
                address: address || null,
                type: type || 'BRANCH',
                isActive: isActive !== undefined ? isActive : true,
                maintenanceCenterId: maintenanceCenterId || null
            }
        });

        res.status(201).json(branch);
    } catch (error) {
        console.error('Failed to create branch:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¥ظ†ط´ط§ط، ط§ظ„ظپط±ط¹' });
    }
});

// Update branch
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { code, name, address, type, maintenanceCenterId, isActive } = req.body;

        // Check if branch exists
        const existing = await db.branch.findUnique({
            where: { id: req.params.id }
        });
        if (!existing) {
            return res.status(404).json({ error: 'ط§ظ„ظپط±ط¹ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        // Check for duplicate code
        if (code && code !== existing.code) {
            const duplicate = await db.branch.findUnique({
                where: { code }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'ظƒظˆط¯ ط§ظ„ظپط±ط¹ ظ…ظˆط¬ظˆط¯ ظ…ط³ط¨ظ‚ط§ظ‹' });
            }
        }

        // Validate maintenanceCenterId if provided
        if (maintenanceCenterId) {
            const center = await db.branch.findUnique({
                where: { id: maintenanceCenterId }
            });
            if (!center || center.type !== 'MAINTENANCE_CENTER') {
                return res.status(400).json({ error: 'ظ…ط±ظƒط² ط§ظ„طµظٹط§ظ†ط© ط؛ظٹط± طµط§ظ„ط­' });
            }
        }

        const branch = await db.branch.update({
            where: { id: req.params.id },
            data: {
                code: code || existing.code,
                name: name || existing.name,
                address: address !== undefined ? address : existing.address,
                type: type || existing.type,
                isActive: isActive !== undefined ? isActive : existing.isActive,
                maintenanceCenterId: maintenanceCenterId !== undefined ? maintenanceCenterId : existing.maintenanceCenterId
            }
        });

        res.json(branch);
    } catch (error) {
        console.error('Failed to update branch:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ طھط­ط¯ظٹط« ط§ظ„ظپط±ط¹' });
    }
});

// Delete branch
router.delete('/:id', authenticateToken, async (req, res) => {
    try {
        // Check if branch has related data
        const branch = await db.branch.findUnique({
            where: { id: req.params.id },
            include: {
                _count: {
                    select: {
                        sentTransfers: true,
                        receivedTransfers: true,
                        users: true,
                        customers: true
                    }
                }
            }
        });

        if (!branch) {
            return res.status(404).json({ error: 'ط§ظ„ظپط±ط¹ ط؛ظٹط± ظ…ظˆط¬ظˆط¯' });
        }

        const totalRelated = (branch._count.sentTransfers || 0) +
            (branch._count.receivedTransfers || 0) +
            (branch._count.users || 0) +
            (branch._count.customers || 0);

        if (totalRelated > 0) {
            return res.status(400).json({
                error: 'ظ„ط§ ظٹظ…ظƒظ† ط­ط°ظپ ط§ظ„ظپط±ط¹ ظ„ظˆط¬ظˆط¯ ط¨ظٹط§ظ†ط§طھ ظ…ط±طھط¨ط·ط© ط¨ظ‡.'
            });
        }

        await db.branch.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'طھظ… ط­ط°ظپ ط§ظ„ظپط±ط¹ ط¨ظ†ط¬ط§ط­' });
    } catch (error) {
        console.error('Failed to delete branch:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط­ط°ظپ ط§ظ„ظپط±ط¹' });
    }
});

// Get branches by type
router.get('/type/:type', authenticateToken, async (req, res) => {
    try {
        const { type } = req.params;
        const branches = await db.branch.findMany({
            where: { type },
            orderBy: { name: 'asc' },
            include: {
                maintenanceCenter: {
                    select: { id: true, name: true, code: true }
                }
            }
        });
        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch branches by type:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ط§ظ„ظپط±ظˆط¹' });
    }
});

// Get maintenance centers with their serviced branches
router.get('/centers/with-branches', authenticateToken, async (req, res) => {
    try {
        const centers = await db.branch.findMany({
            where: { type: 'MAINTENANCE_CENTER' },
            orderBy: { name: 'asc' },
            include: {
                servicedBranches: {
                    select: { id: true, name: true, code: true }
                },
                _count: {
                    select: { servicedBranches: true }
                }
            }
        });
        res.json(centers);
    } catch (error) {
        console.error('Failed to fetch centers:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ظ…ط±ط§ظƒط² ط§ظ„طµظٹط§ظ†ط©' });
    }
});

// Get branches serviced by a specific center
router.get('/center/:centerId/branches', authenticateToken, async (req, res) => {
    try {
        const { centerId } = req.params;
        const branches = await db.branch.findMany({
            where: { maintenanceCenterId: centerId },
            orderBy: { name: 'asc' }
        });
        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch center branches:', error);
        res.status(500).json({ error: 'ظپط´ظ„ ظپظٹ ط¬ظ„ط¨ ظپط±ظˆط¹ ط§ظ„ظ…ط±ظƒط²' });
    }
});

module.exports = router;

