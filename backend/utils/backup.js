const fs = require('fs').promises;
const path = require('path');

const DB_PATH = path.join(__dirname, '../prisma/dev.db');
const BACKUP_DIR = path.join(__dirname, '../backups');

/**
 * Ensure backups directory exists
 */
async function ensureBackupDir() {
    try {
        await fs.access(BACKUP_DIR);
    } catch {
        await fs.mkdir(BACKUP_DIR, { recursive: true });
    }
}

/**
 * Create a backup of the database
 * @param {string} label - Optional label for the backup (e.g., 'pre_restore')
 * @returns {Promise<{filename: string, size: number}>}
 */
async function createBackup(label = '') {
    await ensureBackupDir();

    const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');

    const filename = label
        ? `backup_${label}_${timestamp}.db`
        : `backup_${timestamp}.db`;

    const backupPath = path.join(BACKUP_DIR, filename);

    // Copy database file
    await fs.copyFile(DB_PATH, backupPath);

    // Get file size
    const stats = await fs.stat(backupPath);

    return {
        filename,
        size: stats.size,
        createdAt: new Date().toISOString()
    };
}

/**
 * List all backups with metadata
 * @returns {Promise<Array<{filename: string, size: number, createdAt: string}>>}
 */
async function listBackups() {
    try {
        await ensureBackupDir();
        const files = await fs.readdir(BACKUP_DIR);

        const backups = await Promise.all(
            files
                .filter(f => f.endsWith('.db'))
                .map(async (filename) => {
                    const filePath = path.join(BACKUP_DIR, filename);
                    const stats = await fs.stat(filePath);
                    return {
                        filename,
                        size: stats.size,
                        createdAt: stats.mtime.toISOString()
                    };
                })
        );

        // Sort by creation date, newest first
        return backups.sort((a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
    } catch (error) {
        console.error('Failed to list backups:', error);
        return [];
    }
}

/**
 * Restore database from backup
 * @param {string} filename - Backup filename to restore from
 * @returns {Promise<void>}
 */
async function restoreBackup(filename) {
    // Validate filename to prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename');
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    // Check if backup exists
    try {
        await fs.access(backupPath);
    } catch {
        throw new Error('Backup file not found');
    }

    // Create safety backup before restore
    await createBackup('pre_restore');

    // Replace current database with backup
    await fs.copyFile(backupPath, DB_PATH);
}

/**
 * Delete a backup file
 * @param {string} filename - Backup filename to delete
 * @returns {Promise<void>}
 */
async function deleteBackup(filename) {
    // Validate filename
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename');
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    await fs.unlink(backupPath);
}

/**
 * Clean old backups (keep last N days)
 * @param {number} daysToKeep - Number of days to keep (default: 30)
 * @returns {Promise<number>} - Number of backups deleted
 */
async function cleanOldBackups(daysToKeep = 30) {
    const backups = await listBackups();
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    let deleteCount = 0;

    for (const backup of backups) {
        const backupDate = new Date(backup.createdAt);
        if (backupDate < cutoffDate) {
            await deleteBackup(backup.filename);
            deleteCount++;
        }
    }

    return deleteCount;
}

module.exports = {
    createBackup,
    listBackups,
    restoreBackup,
    deleteBackup,
    cleanOldBackups
};
