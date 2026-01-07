const express = require('express');
const router = express.Router();
const { createBackup, listBackups, restoreBackup, deleteBackup } = require('../utils/backup');
const { logAction } = require('../utils/logger');
const { authenticateToken } = require('../middleware/auth');
const { ensureBranchWhere } = require('../prisma/branchHelpers');
// NOTE: This file flagged by automated branch-filter scan. Consider using `ensureBranchWhere(args, req))` for Prisma calls where appropriate.
// NOTE: automated inserted imports for branch-filtering and safe raw SQL

// POST /api/backup/create - Create manual backup
router.post('/create', authenticateToken, async (req, res) => {
    try {
        const backup = await createBackup();

        // Log backup creation
        await logAction({
            entityType: 'SYSTEM',
            entityId: backup.filename,
            action: 'BACKUP_CREATE',
            details: JSON.stringify({ size: backup.size }),
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: req.user?.branchId
        });

        res.json({
            success: true,
            backup
        });
    } catch (error) {
        console.error('Failed to create backup:', error);
        res.status(500).json({ error: 'Failed to create backup' });
    }
});

// GET /api/backup/list - List all backups
router.get('/list', authenticateToken, async (req, res) => {
    try {
        const backups = await listBackups();
        res.json(backups);
    } catch (error) {
        console.error('Failed to list backups:', error);
        res.status(500).json({ error: 'Failed to list backups' });
    }
});

// POST /api/backup/restore/:filename - Restore from backup
router.post('/restore/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;

        await restoreBackup(filename);

        // Log restore action
        await logAction({
            entityType: 'SYSTEM',
            entityId: filename,
            action: 'BACKUP_RESTORE',
            details: JSON.stringify({ restoredFrom: filename }),
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: req.user?.branchId
        });

        res.json({
            success: true,
            message: 'Database restored successfully. Please restart the server.'
        });
    } catch (error) {
        console.error('Failed to restore backup:', error);
        res.status(500).json({ error: error.message || 'Failed to restore backup' });
    }
});

// DELETE /api/backup/delete/:filename - Delete backup
router.delete('/delete/:filename', authenticateToken, async (req, res) => {
    try {
        const { filename } = req.params;

        await deleteBackup(filename);

        // Log deletion
        await logAction({
            entityType: 'SYSTEM',
            entityId: filename,
            action: 'BACKUP_DELETE',
            details: JSON.stringify({ deletedFile: filename }),
            userId: req.user?.id,
            performedBy: req.user?.displayName || 'System',
            branchId: req.user?.branchId
        });

        res.json({ success: true });
    } catch (error) {
        console.error('Failed to delete backup:', error);
        res.status(500).json({ error: error.message || 'Failed to delete backup' });
    }
});

// GET /api/backup/logs - Get recent backup activity logs
router.get('/logs', authenticateToken, async (req, res) => {
    try {
        const db = require('../db');
        const limit = parseInt(req.query.limit) || 10;

        const logs = await db.systemLog.findMany({
            where: {
                action: {
                    in: ['BACKUP_CREATE', 'BACKUP_RESTORE', 'BACKUP_DELETE']
                },
                branchId: { not: null }
            },
            orderBy: { createdAt: 'desc' },
            take: limit
        });

        res.json(logs);
    } catch (error) {
        console.error('Failed to fetch backup logs:', error);
        res.status(500).json({ error: 'Failed to fetch backup logs' });
    }
});

module.exports = router;
