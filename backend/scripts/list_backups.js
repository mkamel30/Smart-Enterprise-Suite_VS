const fs = require('fs');
const path = require('path');

const backupDir = path.resolve('e:/Programming/CS_under DEvelopment/CS-Dept-Console/backend/backups');

if (fs.existsSync(backupDir)) {
    const files = fs.readdirSync(backupDir).map(file => {
        const fullPath = path.join(backupDir, file);
        const stats = fs.statSync(fullPath);
        return {
            name: file,
            size: stats.size,
            mtime: stats.mtime
        };
    });

    files.sort((a, b) => b.mtime - a.mtime);

    console.log('BACKUP_LIST:' + JSON.stringify(files));
} else {
    console.log('No backups directory found.');
}
