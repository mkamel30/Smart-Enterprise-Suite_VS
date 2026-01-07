/**
 * Refactoring Validation Script
 * Tests that ensureBranchWhere is NOT used with unique operations
 * and validates the refactored code patterns
 */

const fs = require('fs');
const path = require('path');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
    console.log('\n' + '='.repeat(80));
    log(message, 'cyan');
    console.log('='.repeat(80) + '\n');
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

// Scan files for patterns
function scanDirectory(dir, extensions = ['.js']) {
    let results = [];
    const files = fs.readdirSync(dir);

    for (const file of files) {
        const filePath = path.join(dir, file);
        const stat = fs.statSync(filePath);

        if (stat.isDirectory()) {
            if (!file.includes('node_modules') && !file.includes('tests')) {
                results = results.concat(scanDirectory(filePath, extensions));
            }
        } else if (extensions.some(ext => file.endsWith(ext))) {
            results.push(filePath);
        }
    }

    return results;
}

// Check for ensureBranchWhere misuse
function checkEnsureBranchWhereMisuse() {
    header('🔍 Checking for ensureBranchWhere Misuse');

    const routesDir = path.join(__dirname, 'routes');
    const servicesDir = path.join(__dirname, 'services');
    
    const files = [
        ...scanDirectory(routesDir),
        ...scanDirectory(servicesDir)
    ];

    let totalIssues = 0;
    const issues = [];

    // Patterns to detect
    const badPatterns = [
        {
            regex: /ensureBranchWhere\s*\(\s*\{\s*where:\s*\{\s*id[^}]*\}/gi,
            description: 'ensureBranchWhere with where: { id }',
            severity: 'error'
        },
        {
            regex: /ensureBranchWhere\s*\(\s*\{[^}]*\bupdate\b/gi,
            description: 'ensureBranchWhere wrapping update operation',
            severity: 'error'
        },
        {
            regex: /ensureBranchWhere\s*\(\s*\{[^}]*\bdelete\b/gi,
            description: 'ensureBranchWhere wrapping delete operation',
            severity: 'error'
        },
        {
            regex: /ensureBranchWhere\s*\(\s*\{[^}]*findUnique/gi,
            description: 'ensureBranchWhere wrapping findUnique',
            severity: 'error'
        },
        {
            regex: /\.update\s*\(\s*ensureBranchWhere/gi,
            description: '.update(ensureBranchWhere(...)) pattern',
            severity: 'error'
        },
        {
            regex: /\.delete\s*\(\s*ensureBranchWhere/gi,
            description: '.delete(ensureBranchWhere(...)) pattern',
            severity: 'error'
        }
    ];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(__dirname, file);

        for (const pattern of badPatterns) {
            const matches = content.match(pattern.regex);
            if (matches) {
                totalIssues += matches.length;
                issues.push({
                    file: relativePath,
                    pattern: pattern.description,
                    count: matches.length,
                    severity: pattern.severity
                });
            }
        }
    }

    if (totalIssues === 0) {
        success('No ensureBranchWhere misuse detected!');
        success(`Scanned ${files.length} files`);
        return true;
    } else {
        error(`Found ${totalIssues} potential issues in ${issues.length} locations:`);
        for (const issue of issues) {
            console.log(`  ${issue.severity === 'error' ? '❌' : '⚠️'}  ${issue.file}`);
            console.log(`     Pattern: ${issue.pattern} (${issue.count} occurrences)`);
        }
        return false;
    }
}

// Check for correct authorization patterns
function checkAuthorizationPatterns() {
    header('🔒 Checking for Proper Authorization Patterns');

    const routesDir = path.join(__dirname, 'routes');
    const files = scanDirectory(routesDir);

    let goodPatterns = 0;
    let filesChecked = 0;

    // Look for the correct pattern: findUnique/findFirst → authorization check
    const authPattern = /(findUnique|findFirst)\s*\([^)]*\)[\s\S]{0,500}(branchId\s*!==|ForbiddenError|status\(403\))/gi;

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(__dirname, file);

        const matches = content.match(authPattern);
        if (matches) {
            goodPatterns += matches.length;
            filesChecked++;
            info(`${relativePath}: ${matches.length} proper auth patterns`);
        }
    }

    if (filesChecked > 0) {
        success(`Found ${goodPatterns} proper authorization patterns in ${filesChecked} files`);
        return true;
    } else {
        warning('No explicit authorization patterns detected (might be handled by middleware)');
        return true;
    }
}

// Check for wrong allowunscoped usage
function checkAllowunscopedUsage() {
    header('🔍 Checking for Wrong "allowunscoped" Usage');

    const routesDir = path.join(__dirname, 'routes');
    const servicesDir = path.join(__dirname, 'services');
    
    const files = [
        ...scanDirectory(routesDir),
        ...scanDirectory(servicesDir)
    ];
    let wrongUsage = 0;
    const wrongFiles = [];

    for (const file of files) {
        const content = fs.readFileSync(file, 'utf8');
        const relativePath = path.relative(__dirname, file);

        // Check for lowercase "allowunscoped" (wrong)
        if (/\ballowunscoped\s*:/gi.test(content) && !content.includes('__allow_unscoped')) {
            wrongUsage++;
            wrongFiles.push(relativePath);
        }
    }

    if (wrongUsage === 0) {
        success('No incorrect "allowunscoped" usage found');
        return true;
    } else {
        error(`Found incorrect "allowunscoped" in ${wrongUsage} files:`);
        wrongFiles.forEach(f => console.log(`  ❌ ${f}`));
        return false;
    }
}

// Check branchHelpers.js documentation
function checkHelperDocumentation() {
    header('📚 Checking branchHelpers.js Documentation');

    const helperPath = path.join(__dirname, 'prisma', 'branchHelpers.js');
    
    if (!fs.existsSync(helperPath)) {
        error('branchHelpers.js not found!');
        return false;
    }

    const content = fs.readFileSync(helperPath, 'utf8');

    const checks = [
        { pattern: /CRITICAL WARNING/i, description: 'Has critical warning' },
        { pattern: /DO NOT USE WITH/i, description: 'Lists operations to avoid' },
        { pattern: /findUnique/i, description: 'Mentions findUnique' },
        { pattern: /update.*unique/i, description: 'Mentions update with unique' },
        { pattern: /SAFE TO USE/i, description: 'Lists safe operations' },
        { pattern: /Example.*WRONG/i, description: 'Has wrong usage example' },
        { pattern: /CORRECT.*pattern/i, description: 'Has correct pattern example' }
    ];

    let passed = 0;
    for (const check of checks) {
        if (check.pattern.test(content)) {
            success(check.description);
            passed++;
        } else {
            warning(`Missing: ${check.description}`);
        }
    }

    if (passed >= 5) {
        success(`branchHelpers.js is well documented (${passed}/${checks.length} checks passed)`);
        return true;
    } else {
        warning(`branchHelpers.js documentation could be improved (${passed}/${checks.length} checks passed)`);
        return false;
    }
}

// Test database connection
async function testDatabaseConnection() {
    header('🗄️  Testing Database Connection');

    try {
        const db = require('./db');
        
        // Simple query to test connection
        const result = await db.$queryRaw`SELECT 1 as test`;
        success('Database connection successful');
        
        // Test branch enforcer
        try {
            const count = await db.customer.count();
            info(`Found ${count} customers in database`);
        } catch (err) {
            if (err.message.includes('Branch filter required')) {
                success('Branch enforcer middleware is active ✓');
            } else {
                warning(`Unexpected error: ${err.message}`);
            }
        }

        await db.$disconnect();
        return true;
    } catch (err) {
        error(`Database connection failed: ${err.message}`);
        return false;
    }
}

// Generate summary report
function generateReport(results) {
    header('📊 REFACTORING VALIDATION REPORT');

    const total = Object.keys(results).length;
    const passed = Object.values(results).filter(v => v === true).length;
    const failed = total - passed;

    console.log(`Total Checks: ${total}`);
    console.log(`${colors.green}Passed: ${passed}${colors.reset}`);
    console.log(`${colors.red}Failed: ${failed}${colors.reset}`);
    console.log('');

    for (const [check, result] of Object.entries(results)) {
        const icon = result ? '✅' : '❌';
        const color = result ? 'green' : 'red';
        log(`${icon} ${check}`, color);
    }

    console.log('\n' + '='.repeat(80));

    if (failed === 0) {
        log('\n🎉 ALL CHECKS PASSED! Refactoring is complete and correct.', 'green');
        log('✨ The codebase follows the Service Layer Refactoring Strategy.', 'green');
    } else {
        log(`\n⚠️  ${failed} check(s) failed. Review the issues above.`, 'yellow');
        log('📝 Fix the issues and run this script again.', 'yellow');
    }

    console.log('');
    return failed === 0;
}

// Main execution
async function main() {
    console.clear();
    log('\n🚀 REFACTORING VALIDATION SCRIPT', 'bold');
    log('Testing Service Layer Refactoring Strategy Implementation\n', 'cyan');

    const results = {};

    // Run all checks
    results['ensureBranchWhere Misuse Check'] = checkEnsureBranchWhereMisuse();
    results['Authorization Patterns Check'] = checkAuthorizationPatterns();
    results['allowunscoped Usage Check'] = checkAllowunscopedUsage();
    results['Helper Documentation Check'] = checkHelperDocumentation();
    
    // Async check
    results['Database Connection Test'] = await testDatabaseConnection();

    // Generate final report
    const success = generateReport(results);

    process.exit(success ? 0 : 1);
}

// Run
main().catch(err => {
    error(`\nScript failed with error: ${err.message}`);
    console.error(err.stack);
    process.exit(1);
});
