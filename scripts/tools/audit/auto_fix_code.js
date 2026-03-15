/**
 * Auto-fix Critical Code Issues
 * Focuses on the most dangerous patterns that cause runtime crashes
 */

const fs = require('fs');
const path = require('path');

let fixCount = 0;
const fixedFiles = [];

function fixFile(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let fileFixed = false;

    // Pattern 1: Fix data?.map() where data comes from API and might be undefined
    // Look for patterns like: {data.someArray.map(
    // Replace with: {Array.isArray(data?.someArray) && data.someArray.map(

    // Pattern 2: Fix branches?.map() specifically (common issue)
    const branchesMapPattern = /\{branches\.map\(/g;
    if (branchesMapPattern.test(content)) {
        content = content.replace(
            /\{branches\.map\(/g,
            '{Array.isArray(branches) && branches.map('
        );
        fileFixed = true;
    }

    // Pattern 3: Fix {someArray.map( where someArray comes from props/state
    // This is trickier - we need context, so we'll be conservative

    // Pattern 4: Add optional chaining for common API response patterns
    const unsafeApiMapPattern = /\{(\w+)\.(\w+)\.map\(/g;
    const matches = [...content.matchAll(unsafeApiMapPattern)];

    for (const match of matches) {
        const fullMatch = match[0];
        const obj = match[1];
        const prop = match[2];

        // Skip if already has safety check
        if (content.includes(`Array.isArray(${obj}?.${prop})`)) continue;
        if (content.includes(`${obj}?.${prop}?.map`)) continue;

        // Common API response objects that need safety
        if (['data', 'response', 'result', 'items'].includes(obj)) {
            const safeVersion = `{Array.isArray(${obj}?.${prop}) && ${obj}.${prop}.map(`;
            content = content.replace(fullMatch, safeVersion);
            fileFixed = true;
        }
    }

    if (fileFixed && content !== originalContent) {
        fs.writeFileSync(filePath, content, 'utf8');
        fixCount++;
        fixedFiles.push(path.relative(process.cwd(), filePath));
        return true;
    }

    return false;
}

function scanDirectory(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            scanDirectory(fullPath);
        } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
            // Skip type definition files
            if (!entry.name.endsWith('.d.ts') && !entry.name.includes('Types.')) {
                fixFile(fullPath);
            }
        }
    }
}

console.log('🔧 Auto-fixing critical code issues...\n');
scanDirectory(path.join(__dirname, 'frontend', 'src'));

console.log(`\n✅ Fixed ${fixCount} files:\n`);
fixedFiles.slice(0, 20).forEach(f => console.log(`   ✓ ${f}`));
if (fixedFiles.length > 20) {
    console.log(`   ... and ${fixedFiles.length - 20} more`);
}

console.log(`\n⚠️  IMPORTANT: Review the changes before committing!`);
console.log(`   Run: git diff frontend/src`);
