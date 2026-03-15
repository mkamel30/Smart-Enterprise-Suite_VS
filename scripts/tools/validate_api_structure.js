/**
 * API Response Structure Validator
 * Checks if backend API responses match frontend expectations
 */

const fs = require('fs');
const path = require('path');

// Common mismatches to look for
const commonMismatches = {
    // Backend sends X, Frontend expects Y
    'quickStats': 'quickCounts',
    'data': 'items',
    'results': 'data',
    'list': 'items',
};

const issues = {
    apiMismatches: [],
    missingNullChecks: [],
    inconsistentNaming: []
};

function analyzeApiCall(filePath, content) {
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Look for API calls: api.getSomething()
        const apiCallMatch = line.match(/api\.(\w+)\(/);
        if (apiCallMatch) {
            const methodName = apiCallMatch[1];

            // Look for data access in next 20 lines
            const contextLines = lines.slice(index, Math.min(index + 20, lines.length));
            const contextText = contextLines.join('\n');

            // Check for direct property access without null checks
            // Pattern: data.someProperty or response.someProperty
            const directAccessPattern = /\b(data|response|result|items)\.(\w+)(?!\?)/g;
            let match;

            while ((match = directAccessPattern.exec(contextText)) !== null) {
                const objName = match[1];
                const propName = match[2];

                // Check if there's a null check before this access
                const hasNullCheck = contextText.includes(`if (!${objName})`) ||
                    contextText.includes(`if (${objName})`) ||
                    contextText.includes(`${objName}?.`) ||
                    contextText.includes(`Array.isArray(${objName})`);

                if (!hasNullCheck && !propName.includes('map') && !propName.includes('filter')) {
                    issues.missingNullChecks.push({
                        file: relativePath,
                        line: lineNum,
                        apiMethod: methodName,
                        access: `${objName}.${propName}`,
                        suggestion: `Add null check or use optional chaining: ${objName}?.${propName}`
                    });
                }
            }

            // Check for common naming mismatches
            Object.entries(commonMismatches).forEach(([backendName, frontendName]) => {
                if (contextText.includes(`.${backendName}`)) {
                    issues.inconsistentNaming.push({
                        file: relativePath,
                        line: lineNum,
                        apiMethod: methodName,
                        found: backendName,
                        expected: frontendName,
                        suggestion: `Backend might be sending '${backendName}' but frontend expects '${frontendName}'`
                    });
                }
            });
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
            if (!entry.name.endsWith('.d.ts') && !entry.name.includes('Types.')) {
                const content = fs.readFileSync(fullPath, 'utf8');
                analyzeApiCall(fullPath, content);
            }
        }
    }
}

console.log('🔍 Analyzing API calls and response structures...\n');
scanDirectory(path.join(__dirname, 'frontend', 'src'));

// Generate Report
console.log('='.repeat(80));
console.log('📊 API STRUCTURE VALIDATION REPORT\n');

console.log(`⚠️  Missing Null Checks (${issues.missingNullChecks.length}):`);
const uniqueNullChecks = {};
issues.missingNullChecks.forEach(issue => {
    const key = `${issue.file}:${issue.apiMethod}:${issue.access}`;
    if (!uniqueNullChecks[key]) {
        uniqueNullChecks[key] = issue;
    }
});

Object.values(uniqueNullChecks).slice(0, 15).forEach(issue => {
    console.log(`\n   📁 ${issue.file}`);
    console.log(`   🔧 API: ${issue.apiMethod}()`);
    console.log(`   ❌ Unsafe: ${issue.access}`);
    console.log(`   ✅ Fix: ${issue.suggestion}`);
});

if (Object.keys(uniqueNullChecks).length > 15) {
    console.log(`\n   ... and ${Object.keys(uniqueNullChecks).length - 15} more`);
}

console.log(`\n\n🔄 Potential Naming Mismatches (${issues.inconsistentNaming.length}):`);
issues.inconsistentNaming.forEach(issue => {
    console.log(`\n   📁 ${issue.file}:${issue.line}`);
    console.log(`   🔧 API: ${issue.apiMethod}()`);
    console.log(`   ⚠️  ${issue.suggestion}`);
});

console.log('\n' + '='.repeat(80));

// Save detailed report
const reportPath = path.join(__dirname, 'api_validation_report.json');
fs.writeFileSync(reportPath, JSON.stringify({
    summary: {
        missingNullChecks: Object.keys(uniqueNullChecks).length,
        namingMismatches: issues.inconsistentNaming.length,
        totalIssues: Object.keys(uniqueNullChecks).length + issues.inconsistentNaming.length
    },
    details: {
        missingNullChecks: Object.values(uniqueNullChecks),
        inconsistentNaming: issues.inconsistentNaming
    }
}, null, 2));

console.log(`\n📄 Detailed report saved to: ${reportPath}`);
console.log(`\n✅ Analysis complete!`);
console.log(`   Total potential issues: ${Object.keys(uniqueNullChecks).length + issues.inconsistentNaming.length}`);
