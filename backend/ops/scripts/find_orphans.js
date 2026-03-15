const fs = require('fs');
const path = require('path');

const rootDir = path.join(__dirname, '../../');
const dirsToCheck = ['routes', 'services', 'utils', 'middleware'];

const allJsFiles = [];
dirsToCheck.forEach(dir => {
    const fullDir = path.join(rootDir, dir);
    if (!fs.existsSync(fullDir)) return;
    const files = fs.readdirSync(fullDir)
        .filter(f => f.endsWith('.js'))
        .map(f => path.join(dir, f));
    allJsFiles.push(...files);
});

console.log('Total files to check:', allJsFiles.length);

const allSrcContent = [];
const walkSync = (dir) => {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (!['node_modules', 'tests', 'ops', 'logs', 'dumps'].includes(file)) {
                walkSync(fullPath);
            }
        } else if (file.endsWith('.js') && file !== 'find_orphans.js') {
            allSrcContent.push(fs.readFileSync(fullPath, 'utf8'));
        }
    }
};

walkSync(rootDir);
const combinedSrc = allSrcContent.join('\n');

const orphans = [];
allJsFiles.forEach(file => {
    const basename = path.basename(file, '.js');
    if (!combinedSrc.includes(basename)) {
        if (!['server', 'db', 'app'].includes(basename)) {
            orphans.push(file);
        }
    }
});

console.log('\nPotential Orphans:');
orphans.forEach(o => console.log(o));
