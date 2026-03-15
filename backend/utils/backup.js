const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const BACKUP_DIR = path.join(__dirname, '../backups');

// Docker container info
const CONTAINER_NAME = 'ses_postgres';
const DB_USER = 'postgres';
const DB_NAME = 'smart_enterprise';

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

    const extension = '.sql';
    const filename = label
        ? `backup_${label}_${timestamp}${extension}`
        : `backup_${timestamp}${extension}`;

    const backupPath = path.join(BACKUP_DIR, filename);

    try {
        // Execute pg_dump inside docker container
        // Use -t for pseudo-tty might cause issues in exec, so we avoid it
        // We pipe the output to a file on the host
        const command = `docker exec ${CONTAINER_NAME} pg_dump -U ${DB_USER} ${DB_NAME} > "${backupPath}"`;

        await execPromise(command);

        // Get file size
        const stats = await fs.stat(backupPath);

        return {
            filename,
            size: stats.size,
            createdAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('PostgreSQL Backup Failed:', error);
        throw new Error('فشل إنشاء النسخة الاحتياطية من قاعدة البيانات: ' + error.message);
    }
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
                .filter(f => f.endsWith('.sql') || f.endsWith('.db')) // Support both for transition
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

        // Filter out any nulls and sort by creation date, newest first
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
 * @param {string} filename - Backup filename to restore from
 * @returns {Promise<void>}
 */
async function restoreBackup(filename) {
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        throw new Error('Invalid filename');
    }

    const backupPath = path.join(BACKUP_DIR, filename);

    try {
        await fs.access(backupPath);
    } catch {
        throw new Error('Backup file not found');
    }

    // Safety backup before restore
    await createBackup('pre_restore');

    try {
        if (filename.endsWith('.db')) {
            throw new Error('لا يمكن استرجاع النسخ الاحتياطية القديمة (SQLite) مباشرة إلى PostgreSQL. يرجى التواصل مع الدعم الفني.');
        }

        // Restore PostgreSQL backup
        // 1. Drop and recreate database to ensure clean state
        // We connect to 'postgres' db to drop 'smart_enterprise'
        await execPromise(`docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -d postgres -c "DROP DATABASE IF EXISTS ${DB_NAME};"`);
        await execPromise(`docker exec ${CONTAINER_NAME} psql -U ${DB_USER} -d postgres -c "CREATE DATABASE ${DB_NAME};"`);

        // 2. Import SQL file
        // Note: < redirection might be tricky with exec, so we use cat or docker cp
        // Using docker exec with stdin redirection:
        const command = `docker exec -i ${CONTAINER_NAME} psql -U ${DB_USER} ${DB_NAME} < "${backupPath}"`;
        await execPromise(command);

    } catch (error) {
        console.error('PostgreSQL Restore Failed:', error);
        throw new Error('فشل استرجاع قاعدة البيانات: ' + error.message);
    }
}

/**
 * Delete a backup file
 * @param {string} filename - Backup filename to delete
 * @returns {Promise<void>}
 */
async function deleteBackup(filename) {
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
