const express = require('express');
const router = express.Router();
const db = require('../../../db');
const { authenticateToken } = require('../../../middleware/auth');
const { ensureBranchWhere } = require('../../../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

const { parsePaginationParams, createPaginationResponse } = require('../../../utils/pagination');
const { ROLES, isGlobalRole } = require('../../../utils/constants');
const security = require('../../../utils/security');

// GET current system HWID (for Admin to copy)
router.get('/system-info/hwid', authenticateToken, (req, res) => {
    res.json({ hwid: security.getHWID() });
});

// Get all branches - PAGINATED
router.get('/', authenticateToken, async (req, res) => {
    try {
        const { limit, offset } = parsePaginationParams(req.query);
        const [branches, total] = await Promise.all([
            db.branch.findMany({
                orderBy: { createdAt: 'desc' },
                include: {
                    parentBranch: { select: { id: true, name: true, code: true } },
                    maintenanceCenter: { select: { id: true, name: true, code: true } },
                    _count: {
                        select: {
                            users: true,
                            customers: true,
                            requests: true
                        }
                    }
                },
                take: limit,
                skip: offset
            }),
            db.branch.count()
        ]);
        res.json(createPaginationResponse(branches, total, limit, offset));
    } catch (error) {
        console.error('Failed to fetch branches:', error);
        res.status(500).json({ error: 'فشل في جلب الفروع' });
    }
});

// Get authorized branches for the current user
router.get('/authorized', authenticateToken, async (req, res) => {
    try {
        const { role, branchId } = req.user;
        const authorizedIds = req.user.authorizedBranchIds || (branchId ? [branchId] : []);

        let where = {};

        // Global roles see all branches
        if (isGlobalRole(role)) {
            // No filter
        } else {
            // Others see only authorized branches
            if (authorizedIds.length > 0) {
                where.id = { in: authorizedIds };
            } else {
                // If no authorized branches, return empty (shouldn't happen for valid users)
                return res.json([]);
            }
        }

        const branches = await db.branch.findMany({
            where,
            orderBy: { name: 'asc' },
            select: {
                id: true,
                name: true,
                code: true,
                type: true,
                isActive: true,
                parentBranchId: true,
                maintenanceCenterId: true
            }
        });

        res.json(branches);
    } catch (error) {
        console.error('Failed to fetch authorized branches:', error);
        res.status(500).json({ error: 'فشل في جلب الفروع المصرح بها' });
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
            return res.status(404).json({ error: 'الفرع غير موجود' });
        }
        res.json(branch);
    } catch (error) {
        console.error('Failed to fetch branch:', error);
        res.status(500).json({ error: 'فشل في جلب الفرع' });
    }
});

// Create branch
router.post('/', authenticateToken, async (req, res) => {
    try {
        let { code, name, address, type, maintenanceCenterId, parentBranchId, isActive, authorizedHWID } = req.body;

        if (!name) {
            return res.status(400).json({ error: 'الاسم مطلوب' });
        }

        if (!code) {
           const branches = await db.branch.findMany({
               where: { code: { startsWith: 'BR' } },
               select: { code: true }
           });
           let nextNum = 1;
           if (branches.length > 0) {
              const maxNum = branches.map(b => {
                 const match = b.code.match(/BR(\d+)/);
                 return match ? parseInt(match[1], 10) : 0;
              }).sort((a,b) => b - a)[0];
              nextNum = maxNum + 1;
           }
           code = `BR${String(nextNum).padStart(3, '0')}`;
           while (await db.branch.findUnique({ where: { code } })) {
               nextNum++;
               code = `BR${String(nextNum).padStart(3, '0')}`;
           }
        } else {
            // Check for duplicate code if provided manually
            const existing = await db.branch.findUnique({
                where: { code }
            });
            if (existing) {
                return res.status(400).json({ error: 'كود الفرع موجود مسبقاً' });
            }
        }

        // Validate maintenanceCenterId if provided
        if (maintenanceCenterId) {
            const center = await db.branch.findUnique({
                where: { id: maintenanceCenterId }
            });
            if (!center || center.type !== 'MAINTENANCE_CENTER') {
                return res.status(400).json({ error: 'مركز الصيانة غير صالح' });
            }
        }

        const branch = await db.branch.create({
            data: {
                code,
                name,
                address: address || null,
                type: type || 'BRANCH',
                isActive: isActive !== undefined ? isActive : true,
                maintenanceCenterId: maintenanceCenterId || null,
                parentBranchId: parentBranchId || null,
                authorizedHWID: authorizedHWID || null
            }
        });

        res.status(201).json(branch);
    } catch (error) {
        console.error('Failed to create branch:', error);
        res.status(500).json({ error: 'فشل في إنشاء الفرع' });
    }
});

// Update branch
router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const { code, name, address, type, maintenanceCenterId, parentBranchId, isActive, authorizedHWID } = req.body;

        // Check if branch exists
        const existing = await db.branch.findUnique({
            where: { id: req.params.id }
        });
        if (!existing) {
            return res.status(404).json({ error: 'الفرع غير موجود' });
        }

        // Check for duplicate code
        if (code && code !== existing.code) {
            const duplicate = await db.branch.findUnique({
                where: { code }
            });
            if (duplicate) {
                return res.status(400).json({ error: 'كود الفرع موجود مسبقاً' });
            }
        }

        // Validate maintenanceCenterId if provided
        if (maintenanceCenterId) {
            const center = await db.branch.findUnique({
                where: { id: maintenanceCenterId }
            });
            if (!center || center.type !== 'MAINTENANCE_CENTER') {
                return res.status(400).json({ error: 'مركز الصيانة غير صالح' });
            }
        }

        const branch = await db.branch.update({
            where: { id: req.params.id },
            data: {
                code: code || existing.code,
                name: name || existing.name,
                address: address !== undefined ? (address || null) : existing.address,
                type: type || existing.type,
                isActive: isActive !== undefined ? isActive : existing.isActive,
                maintenanceCenterId: maintenanceCenterId !== undefined ? (maintenanceCenterId || null) : existing.maintenanceCenterId,
                parentBranchId: parentBranchId !== undefined ? (parentBranchId || null) : existing.parentBranchId,
                authorizedHWID: authorizedHWID !== undefined ? (authorizedHWID || null) : existing.authorizedHWID
            }
        });

        res.json(branch);
    } catch (error) {
        console.error('Failed to update branch:', error);
        res.status(500).json({ error: 'فشل في تحديث الفرع' });
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
            const reasons = [];
            if (branch._count.users > 0) reasons.push(`${branch._count.users} موظف`);
            if (branch._count.customers > 0) reasons.push(`${branch._count.customers} عميل`);
            if ((branch._count.sentTransfers || 0) + (branch._count.receivedTransfers || 0) > 0) reasons.push(`عمليات تحويل مخزني`);

            return res.status(400).json({
                error: `لا يمكن حذف الفرع لوجود: ${reasons.join('، ')}. يجب نقل هذه البيانات أولاً.`
            });
        }

        await db.branch.delete({
            where: { id: req.params.id }
        });

        res.json({ message: 'تم حذف الفرع بنجاح' });
    } catch (error) {
        console.error('Failed to delete branch:', error);
        res.status(500).json({ error: 'فشل في حذف الفرع' });
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
        res.status(500).json({ error: 'فشل في جلب مراكز الصيانة' });
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
        res.status(500).json({ error: 'فشل في جلب فروع المركز' });
    }
});

module.exports = router;

