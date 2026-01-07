const fs = require('fs');
const path = require('path');

const backupFile = 'backend/backups/backup_scheduled_2025-12-26_00-00-00.db';
const fullPath = path.resolve('e:/Programming/CS_under DEvelopment/CS-Dept-Console', backupFile);

if (fs.existsSync(fullPath)) {
    console.log(`${backupFile}: ${fs.statSync(fullPath).size} bytes`);
} else {
    console.log(`${backupFile}: Not found`);
}
