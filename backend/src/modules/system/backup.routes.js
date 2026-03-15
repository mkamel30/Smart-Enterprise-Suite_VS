const express = require('express');
const router = express.Router();
const { createBackup, listBackups, restoreBackup, deleteBackup } = require('../../../utils/backup');
const { logAction } = require('../../../utils/logger');
const { authenticateToken } = require('../../../middleware/auth');
const asyncHandler = require('../../../utils/asyncHandler');
const db = require('../../../db');

// POST /create - Create manual backup
router.post('/create', authenticateToken, asyncHandler(async (req, res) => {
    const backup = await createBackup();

    await logAction({
        entityType: 'SYSTEM', entityId: backup.filename, action: 'BACKUP_CREATE',
        details: { size: backup.size }, userId: req.user.id,
        performedBy: req.user.displayName, branchId: req.user.branchId
    });

    res.json({ success: true, backup });
}));

// GET /list - List all backups
router.get('/list', authenticateToken, asyncHandler(async (req, res) => {
    const backups = await listBackups();
    res.json(backups);
}));

// POST /restore/:filename - Restore from backup
router.post('/restore/:filename', authenticateToken, asyncHandler(async (req, res) => {
    const { filename } = req.params;
    await restoreBackup(filename);

    await logAction({
        entityType: 'SYSTEM', entityId: filename, action: 'BACKUP_RESTORE',
        details: { restoredFrom: filename }, userId: req.user.id,
        performedBy: req.user.displayName, branchId: req.user.branchId
    });

    res.json({
        success: true,
        message: 'تم استرجاع قاعدة البيانات بنجاح. يرجى إعادة تشغيل السيرفر.'
    });
}));

// DELETE /delete/:filename - Delete backup
router.delete('/delete/:filename', authenticateToken, asyncHandler(async (req, res) => {
    const { filename } = req.params;
    await deleteBackup(filename);

    await logAction({
        entityType: 'SYSTEM', entityId: filename, action: 'BACKUP_DELETE',
        details: { deletedFile: filename }, userId: req.user.id,
        performedBy: req.user.displayName, branchId: req.user.branchId
    });

    res.json({ success: true });
}));

module.exports = router;
