const fs = require('fs').promises;
const path = require('path');
const { existsSync } = require('fs');

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DB_PATH = path.join(process.cwd(), 'prisma', 'dev.db');

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
 * Create a backup of the SQLite database
 */
async function createBackup(label = '') {
    await ensureBackupDir();

    if (!existsSync(DB_PATH)) {
        throw new Error('Database file not found at ' + DB_PATH);
    }

    const timestamp = new Date().toISOString()
        .replace(/:/g, '-')
        .replace(/\..+/, '')
        .replace('T', '_');

    const filename = label
        ? `backup_${label}_${timestamp}.db`
        : `backup_${timestamp}.db`;

    const backupPath = path.join(BACKUP_DIR, filename);

    try {
        // For SQLite, a simple file copy is often sufficient if not under heavy write
        // For WAL mode, we might want to be careful, but copyFile is generally okay
        await fs.copyFile(DB_PATH, backupPath);

        const stats = await fs.stat(backupPath);

        return {
            filename,
            size: stats.size,
            createdAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('SQLite Backup Failed:', error);
        throw new Error('فشل إنشاء النسخة الاحتياطية: ' + error.message);
    }
}

/**
 * List all backups
 */
async function listBackups() {
    try {
        await ensureBackupDir();
        const files = await fs.readdir(BACKUP_DIR);

        const backups = await Promise.all(
            files
                .filter(f => f.endsWith('.db') || f.endsWith('.sql'))
                .map(async (filename) => {
                    const filePath = path.join(BACKUP_DIR, filename);
                    try {
                        const stats = await fs.stat(filePath);
                        return {
                            filename,
                            size: stats.size,
                            createdAt: stats.mtime.toISOString()
                        };
                    } catch (e) {
                        return null;
                    }
                })
        );

        return backups
            .filter(b => b !== null)
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    } catch (error) {
        console.error('Failed to list backups:', error);
        return [];
    }
}

/**
 * Restore database from backup
 */
async function restoreBackup(filename) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename');
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    if (!existsSync(backupPath)) {
        throw new Error('Backup file not found');
    }

    // Safety backup before restore
    await createBackup('pre_restore');

    try {
        // To restore SQLite, we just overwrite the dev.db
        // IMPORTANT: In a real production environment, we should ensure no other processes are writing to it.
        // Since this is a stand-alone app, we assuming the server will restart after restore.
        await fs.copyFile(backupPath, DB_PATH);
        
        // Also handle WAL files if they exist (delete them to force clean state from main DB file)
        const walPath = DB_PATH + '-wal';
        const shmPath = DB_PATH + '-shm';
        if (existsSync(walPath)) await fs.unlink(walPath).catch(() => {});
        if (existsSync(shmPath)) await fs.unlink(shmPath).catch(() => {});

    } catch (error) {
        console.error('SQLite Restore Failed:', error);
        throw new Error('فشل استرجاع قاعدة البيانات: ' + error.message);
    }
}

/**
 * Delete a backup file
 */
async function deleteBackup(filename) {
    const backupPath = path.join(BACKUP_DIR, filename);
    if (existsSync(backupPath)) {
        await fs.unlink(backupPath);
    }
}

/**
 * Clean old backups
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
