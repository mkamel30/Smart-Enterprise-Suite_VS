const fs = require('fs');
const path = require('path');

const filesToCheck = [
    'prisma/dev.db',
    'backend/prisma/dev.db',
    'backend/prisma/dev.db.bak.temp',
    'backend/dev.db'
];

filesToCheck.forEach(file => {
    const fullPath = path.resolve('e:/Programming/CS_under DEvelopment/CS-Dept-Console', file);
    if (fs.existsSync(fullPath)) {
        const stats = fs.statSync(fullPath);
        console.log(`${file}: ${stats.size} bytes - Modified: ${stats.mtime}`);
    } else {
        console.log(`${file}: Does not exist`);
    }
});
