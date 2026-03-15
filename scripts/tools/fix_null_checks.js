/**
 * Smart Auto-Fix for Null Checks
 * Adds optional chaining (?.) where needed
 */

const fs = require('fs');
const path = require('path');

const report = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'api_validation_report.json'),
    'utf8'
));

let fixedCount = 0;
const fixedFiles = new Set();

// Group issues by file
const issuesByFile = {};
report.details.missingNullChecks.forEach(issue => {
    if (!issuesByFile[issue.file]) {
        issuesByFile[issue.file] = [];
    }
    issuesByFile[issue.file].push(issue);
});

// Fix each file
Object.entries(issuesByFile).forEach(([relPath, issues]) => {
    const filePath = path.join(__dirname, relPath);

    if (!fs.existsSync(filePath)) {
        console.log(`⚠️  File not found: ${relPath}`);
        return;
    }

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    // Sort issues by line number (descending) to avoid offset issues
    const sortedIssues = issues.sort((a, b) => b.line - a.line);

    sortedIssues.forEach(issue => {
        // Extract the object and property from access pattern
        // e.g., "data.receiptNumber" -> ["data", "receiptNumber"]
        const match = issue.access.match(/^(\w+)\.(\w+)$/);
        if (!match) return;

        const [, objName, propName] = match;

        // Pattern to find: objName.propName (not already with ?.)
        // Make sure it's not already safe
        const unsafePattern = new RegExp(
            `\\b${objName}\\.${propName}\\b(?!\\?)`,
            'g'
        );

        // Check if this pattern exists in the file
        if (unsafePattern.test(content)) {
            // Replace with optional chaining
            const safePattern = `${objName}?.${propName}`;

            // Only replace if not already using optional chaining
            const beforeCount = (content.match(unsafePattern) || []).length;
            content = content.replace(unsafePattern, safePattern);
            const afterCount = (content.match(unsafePattern) || []).length;

            if (beforeCount > afterCount) {
                modified = true;
                fixedCount += (beforeCount - afterCount);
            }
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        fixedFiles.add(relPath);
        console.log(`✅ Fixed: ${relPath}`);
    }
});

console.log('\n' + '='.repeat(80));
console.log('🎉 Auto-Fix Complete!\n');
console.log(`✅ Fixed ${fixedCount} null check issues`);
console.log(`📁 Modified ${fixedFiles.size} files\n`);

if (fixedFiles.size > 0) {
    console.log('Modified files:');
    Array.from(fixedFiles).slice(0, 20).forEach(f => {
        console.log(`   - ${f}`);
    });
    if (fixedFiles.size > 20) {
        console.log(`   ... and ${fixedFiles.size - 20} more`);
    }
}

console.log('\n' + '='.repeat(80));
console.log('\n⚠️  IMPORTANT: Review changes before committing!');
console.log('   Run: git diff frontend/src\n');
