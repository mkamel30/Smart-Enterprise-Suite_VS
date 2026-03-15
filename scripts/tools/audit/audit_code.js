/**
 * Code Quality Audit Script
 * Scans frontend code for common issues and generates a report
 */

const fs = require('fs');
const path = require('path');

const issues = {
    unsafeMapCalls: [],
    missingArrayChecks: [],
    chartWithoutDataCheck: [],
    typeImportIssues: [],
    missingErrorHandling: []
};

function scanFile(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const relativePath = path.relative(process.cwd(), filePath);

    lines.forEach((line, index) => {
        const lineNum = index + 1;

        // Check for .map() without Array.isArray or optional chaining
        if (line.includes('.map(') && !line.includes('?.map(') && !line.includes('Array.isArray')) {
            // Check if there's a check in previous lines (simple heuristic)
            const prevLines = lines.slice(Math.max(0, index - 3), index).join('\n');
            if (!prevLines.includes('Array.isArray') && !prevLines.includes('&&')) {
                issues.unsafeMapCalls.push({
                    file: relativePath,
                    line: lineNum,
                    code: line.trim()
                });
            }
        }

        // Check for Recharts components without data validation
        if (line.includes('ResponsiveContainer') || line.includes('ComposedChart') || line.includes('BarChart')) {
            const componentLines = lines.slice(Math.max(0, index - 10), index).join('\n');
            if (!componentLines.includes('if (') && !componentLines.includes('return')) {
                issues.chartWithoutDataCheck.push({
                    file: relativePath,
                    line: lineNum,
                    code: line.trim()
                });
            }
        }

        // Check for type imports that should be type-only
        if (line.match(/^import\s+{[^}]*}\s+from.*Types/)) {
            if (!line.includes('import type')) {
                issues.typeImportIssues.push({
                    file: relativePath,
                    line: lineNum,
                    code: line.trim()
                });
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
            scanFile(fullPath);
        }
    }
}

// Run scan
console.log('🔍 Starting code quality audit...\n');
scanDirectory(path.join(__dirname, 'frontend', 'src'));

// Generate report
console.log('📊 AUDIT REPORT\n');
console.log('='.repeat(80));

console.log(`\n⚠️  Unsafe .map() calls (${issues.unsafeMapCalls.length}):`);
issues.unsafeMapCalls.slice(0, 10).forEach(issue => {
    console.log(`   ${issue.file}:${issue.line}`);
    console.log(`   ${issue.code}\n`);
});
if (issues.unsafeMapCalls.length > 10) {
    console.log(`   ... and ${issues.unsafeMapCalls.length - 10} more\n`);
}

console.log(`\n📈 Charts without data validation (${issues.chartWithoutDataCheck.length}):`);
issues.chartWithoutDataCheck.slice(0, 5).forEach(issue => {
    console.log(`   ${issue.file}:${issue.line}\n`);
});

console.log(`\n📦 Type import issues (${issues.typeImportIssues.length}):`);
issues.typeImportIssues.forEach(issue => {
    console.log(`   ${issue.file}:${issue.line}`);
    console.log(`   ${issue.code}\n`);
});

console.log('='.repeat(80));
console.log(`\n✅ Audit complete!`);
console.log(`   Total issues found: ${issues.unsafeMapCalls.length +
    issues.chartWithoutDataCheck.length +
    issues.typeImportIssues.length
    }`);

// Write detailed report to file
const reportPath = path.join(__dirname, 'code_audit_report.json');
fs.writeFileSync(reportPath, JSON.stringify(issues, null, 2));
console.log(`\n📄 Detailed report saved to: ${reportPath}`);
