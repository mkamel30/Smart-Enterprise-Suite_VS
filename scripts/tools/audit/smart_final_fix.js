/**
 * Smart Final Fix - Only fix dynamic data, skip constants
 */

const fs = require('fs');
const path = require('path');

const report = JSON.parse(fs.readFileSync(
    path.join(__dirname, 'final_scan_report.json'),
    'utf8'
));

// Constants that are safe (always arrays)
const SAFE_CONSTANTS = [
    'PERIODS', 'MONTHS', 'QUARTERS', 'YEARS',
    'SIM_TYPES', 'PAYMENT_METHODS', 'PAYMENT_PLACES',
    'FONTS', 'ORDER_TYPES', 'COLUMNS', 'TABS',
    'navItems', 'tabs', 'statsCards', 'visibleTypes',
    'displayRoles', 'recoveryCodes', 'columns'
];

// Dynamic data that needs checks
const NEEDS_CHECK = [
    'users', 'requests', 'machines', 'branches',
    'logs', 'searchResults', 'data', 'items',
    'orders', 'payments', 'assignments', 'parts',
    'backups', 'tables', 'records', 'alerts',
    'usedParts', 'branchPerformance', 'movements',
    'clientMachines', 'preview', 'importData',
    'filteredMachines', 'filteredBranches',
    'maintenanceShipments', 'historyOrders',
    'groupInsts', 'availableModels', 'installments',
    'entries', 'chartData', 'rows', 'branchBreakdown',
    'modelChartData', 'actions'
];

let fixedCount = 0;
const fixedFiles = new Set();

// Group by file
const byFile = {};
report.forEach(issue => {
    if (!byFile[issue.file]) byFile[issue.file] = [];
    byFile[issue.file].push(issue);
});

Object.entries(byFile).forEach(([relPath, issues]) => {
    const filePath = path.join(__dirname, relPath);

    if (!fs.existsSync(filePath)) return;

    let content = fs.readFileSync(filePath, 'utf8');
    let modified = false;

    issues.forEach(issue => {
        // Skip if it's a safe constant
        if (SAFE_CONSTANTS.includes(issue.variable)) {
            return;
        }

        // Only fix if it's in the needs-check list
        if (!NEEDS_CHECK.includes(issue.variable)) {
            return;
        }

        // Replace {variable.map( with {Array.isArray(variable) && variable.map(
        const unsafePattern = new RegExp(
            `\\{${issue.variable}\\.map\\(`,
            'g'
        );

        if (unsafePattern.test(content)) {
            const safeReplacement = `{Array.isArray(${issue.variable}) && ${issue.variable}.map(`;
            content = content.replace(unsafePattern, safeReplacement);
            modified = true;
            fixedCount++;
        }
    });

    if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        fixedFiles.add(relPath);
        console.log(`✅ ${relPath}`);
    }
});

console.log('\n' + '='.repeat(80));
console.log(`🎉 Fixed ${fixedCount} unsafe .map() calls in ${fixedFiles.size} files\n`);
console.log('='.repeat(80));
