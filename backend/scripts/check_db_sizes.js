const fs = require('fs');
const path = require('path');

const files = [
    'prisma/dev.db',
    'backend/prisma/dev.db'
];

files.forEach(f => {
    const p = path.resolve('e:/Programming/CS_under DEvelopment/CS-Dept-Console', f);
    if (fs.existsSync(p)) {
        console.log(`${f}: ${fs.statSync(p).size} bytes`);
    } else {
        console.log(`${f}: Not found`);
    }
});
