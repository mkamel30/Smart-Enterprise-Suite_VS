/**
 * Final Scan - Find ALL remaining unsafe .map() calls
 */

const fs = require('fs');
const path = require('path');

const unsafePatterns = [];

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    lines.forEach((line, index) => {
        // Pattern 1: {something.map( without Array.isArray or ?.map
        if (line.match(/\{(\w+)\.map\(/)) {
            const prevLines = lines.slice(Math.max(0, index - 2), index).join('\n');

            // Check if there's NO safety check
            if (!prevLines.includes('Array.isArray') &&
                !line.includes('Array.isArray') &&
                !line.includes('?.map')) {

                const match = line.match(/\{(\w+)\.map\(/);
                if (match) {
                    unsafePatterns.push({
                        file: relativePath,
                        line: index + 1,
                        variable: match[1],
                        code: line.trim()
                    });
                }
            }
        }
    });
}

function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
            if (!entry.name.endsWith('.d.ts')) {
                scanFile(fullPath);
            }
        }
    }
}

console.log('🔍 Final scan for unsafe .map() calls...\n');
scanDirectory(path.join(__dirname, 'frontend', 'src'));

console.log('='.repeat(80));
console.log(`\n⚠️  Found ${unsafePatterns.length} potentially unsafe .map() calls:\n`);

if (unsafePatterns.length > 0) {
    unsafePatterns.slice(0, 20).forEach(issue => {
        console.log(`📁 ${issue.file}:${issue.line}`);
        console.log(`   Variable: ${issue.variable}`);
        console.log(`   Code: ${issue.code}`);
        console.log(`   Fix: {Array.isArray(${issue.variable}) && ${issue.variable}.map(...}\n`);
    });

    if (unsafePatterns.length > 20) {
        console.log(`... and ${unsafePatterns.length - 20} more\n`);
    }
} else {
    console.log('✅ No unsafe .map() calls found! All good!\n');
}

console.log('='.repeat(80));

// Save report
fs.writeFileSync(
    path.join(__dirname, 'final_scan_report.json'),
    JSON.stringify(unsafePatterns, null, 2)
);

console.log(`\n📄 Report saved to: final_scan_report.json`);
console.log(`Total issues: ${unsafePatterns.length}\n`);
