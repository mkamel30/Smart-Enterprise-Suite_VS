/**
 * Project Cleanup Script
 * Scans and removes unused files, backups, and temporary files
 * Run with: node cleanup_project.js [--dry-run]
 */

const fs = require('fs');
const path = require('path');

// ANSI colors
const colors = {
    reset: '\x1b[0m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
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

function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getFileSize(filePath) {
    try {
        return fs.statSync(filePath).size;
    } catch {
        return 0;
    }
}

function scanDirectory(dir, predicate) {
    let results = [];
    try {
        const files = fs.readdirSync(dir);
        
        for (const file of files) {
            const filePath = path.join(dir, file);
            const stat = fs.statSync(filePath);
            
            if (stat.isDirectory()) {
                // Skip node_modules, .git, and other system folders
                if (!['node_modules', '.git', 'dist', 'build'].includes(file)) {
                    results = results.concat(scanDirectory(filePath, predicate));
                }
            } else {
                if (predicate(filePath, file)) {
                    results.push({
                        path: filePath,
                        size: stat.size,
                        relativePath: path.relative(process.cwd(), filePath)
                    });
                }
            }
        }
    } catch (err) {
        // Ignore permission errors
    }
    
    return results;
}

// Category 1: Backup and temporary files
function findBackupFiles() {
    header('🗑️  Finding Backup & Temporary Files');
    
    const patterns = [
        /\.bak$/i,
        /\.old$/i,
        /\.backup$/i,
        /\.tmp$/i,
        /~$/,
        /\.swp$/,
        /-copy\./i,
        /\.orig$/i
    ];
    
    const files = scanDirectory('.', (filePath, fileName) => {
        return patterns.some(pattern => pattern.test(fileName));
    });
    
    if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${files.length} backup/temp files (${formatSize(totalSize)})`, 'yellow');
        files.forEach(f => console.log(`  - ${f.relativePath} (${formatSize(f.size)})`));
        return files;
    } else {
        log('No backup/temp files found', 'green');
        return [];
    }
}

// Category 2: Frontend build error logs
function findBuildErrorLogs() {
    header('📝 Finding Build Error Logs');
    
    const files = scanDirectory('frontend', (filePath, fileName) => {
        return /^build_errors.*\.txt$/i.test(fileName);
    });
    
    if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${files.length} build error logs (${formatSize(totalSize)})`, 'yellow');
        files.forEach(f => console.log(`  - ${f.relativePath} (${formatSize(f.size)})`));
        return files;
    } else {
        log('No build error logs found', 'green');
        return [];
    }
}

// Category 3: Unused debug/test scripts in backend root
function findUnusedDebugScripts() {
    header('🐛 Finding Unused Debug Scripts');
    
    const backendRoot = path.join(process.cwd(), 'backend');
    const unnecessaryScripts = [
        'ahmed_logs_dump.json',
        'egamal_logs_dump.json',
        'machine_logs_dump.json',
        'direct_test.js',
        'fix_summary.js',
        'list_output.txt',
        'debug_full_output.txt',
        'branch_requests.json',
        'transfer_history_result.json',
        'recalculate_test.json',
        'search_raw.js.bak'
    ];
    
    const files = [];
    unnecessaryScripts.forEach(fileName => {
        const filePath = path.join(backendRoot, fileName);
        if (fs.existsSync(filePath)) {
            const size = getFileSize(filePath);
            files.push({
                path: filePath,
                size: size,
                relativePath: path.relative(process.cwd(), filePath)
            });
        }
    });
    
    if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${files.length} debug files in backend root (${formatSize(totalSize)})`, 'yellow');
        files.forEach(f => console.log(`  - ${f.relativePath} (${formatSize(f.size)})`));
        return files;
    } else {
        log('No debug files found in backend root', 'green');
        return [];
    }
}

// Category 4: Root-level test/debug files
function findRootDebugFiles() {
    header('🔍 Finding Root-Level Debug Files');
    
    const rootDebugFiles = [
        'check_actions.js',
        'check_data.js',
        'check_last_order.js',
        'debug_inventory.js',
        'debug_transfers.js',
        'inspect_reject.js',
        'test_apis.js',
        'test_login.js',
        'verify_apis_with_data.js',
        'branch_filter_report.json'
    ];
    
    const files = [];
    rootDebugFiles.forEach(fileName => {
        const filePath = path.join(process.cwd(), fileName);
        if (fs.existsSync(filePath)) {
            const size = getFileSize(filePath);
            files.push({
                path: filePath,
                size: size,
                relativePath: path.relative(process.cwd(), filePath)
            });
        }
    });
    
    if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${files.length} debug files in project root (${formatSize(totalSize)})`, 'yellow');
        files.forEach(f => console.log(`  - ${f.relativePath} (${formatSize(f.size)})`));
        return files;
    } else {
        log('No debug files found in root', 'green');
        return [];
    }
}

// Category 5: Documentation markdown files that are status reports
function findStatusReports() {
    header('📄 Finding Status Report Files');
    
    const reportFiles = [
        'API_DOCUMENTATION.md',
        'API_TEST_RESULTS.md',
        'BRANCH_FILTER_AUDIT.md',
        'BRANCH_FILTER_ISSUES.md',
        'DATABASE_SEEDED.md',
        'ENDPOINT_AUDIT_REPORT.md',
        'FIXES_SUMMARY_JAN_02_2026.md',
        'REMEDIATION_SUMMARY.md',
        'SERVICES_AUDIT_REPORT.md',
        'TRANSFER_PROTECTION_REPORT.md',
        'TRANSFER_VALIDATION_COVERAGE.md'
    ];
    
    const files = [];
    reportFiles.forEach(fileName => {
        const filePath = path.join(process.cwd(), fileName);
        if (fs.existsSync(filePath)) {
            const size = getFileSize(filePath);
            files.push({
                path: filePath,
                size: size,
                relativePath: path.relative(process.cwd(), filePath)
            });
        }
    });
    
    if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${files.length} status report files (${formatSize(totalSize)})`, 'yellow');
        files.forEach(f => console.log(`  - ${f.relativePath} (${formatSize(f.size)})`));
        return files;
    } else {
        log('No status reports found', 'green');
        return [];
    }
}

// Category 6: Old documentation that's been consolidated
function findOldDocumentation() {
    header('📚 Finding Old/Duplicate Documentation');
    
    const oldDocs = [
        path.join('documentation', 'legacy_blueprint.md'),
        path.join('documentation', 'backend.json'),
        path.join('documentation', 'BEFORE_AFTER_COMPARISON.md')
    ];
    
    const files = [];
    oldDocs.forEach(filePath => {
        const fullPath = path.join(process.cwd(), filePath);
        if (fs.existsSync(fullPath)) {
            const size = getFileSize(fullPath);
            files.push({
                path: fullPath,
                size: size,
                relativePath: filePath
            });
        }
    });
    
    if (files.length > 0) {
        const totalSize = files.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${files.length} old documentation files (${formatSize(totalSize)})`, 'yellow');
        files.forEach(f => console.log(`  - ${f.relativePath} (${formatSize(f.size)})`));
        return files;
    } else {
        log('No old documentation found', 'green');
        return [];
    }
}

// Category 7: Unused project folders
function findUnusedFolders() {
    header('📁 Finding Unused Folders');
    
    const unusedFolders = [
        'maintenance-management-system',
        'tools',
        'templates'
    ];
    
    const folders = [];
    unusedFolders.forEach(folderName => {
        const folderPath = path.join(process.cwd(), folderName);
        if (fs.existsSync(folderPath)) {
            const size = getFolderSize(folderPath);
            folders.push({
                path: folderPath,
                size: size,
                relativePath: folderName
            });
        }
    });
    
    if (folders.length > 0) {
        const totalSize = folders.reduce((sum, f) => sum + f.size, 0);
        log(`Found ${folders.length} unused folders (${formatSize(totalSize)})`, 'yellow');
        folders.forEach(f => console.log(`  - ${f.relativePath}/ (${formatSize(f.size)})`));
        return folders;
    } else {
        log('No unused folders found', 'green');
        return [];
    }
}

function getFolderSize(folderPath) {
    let totalSize = 0;
    
    function scan(dir) {
        try {
            const files = fs.readdirSync(dir);
            for (const file of files) {
                const filePath = path.join(dir, file);
                const stat = fs.statSync(filePath);
                
                if (stat.isDirectory()) {
                    scan(filePath);
                } else {
                    totalSize += stat.size;
                }
            }
        } catch (err) {
            // Ignore errors
        }
    }
    
    scan(folderPath);
    return totalSize;
}

// Delete files/folders
function deleteItems(items, type = 'file') {
    let deleted = 0;
    let failed = 0;
    
    for (const item of items) {
        try {
            if (type === 'folder') {
                fs.rmSync(item.path, { recursive: true, force: true });
            } else {
                fs.unlinkSync(item.path);
            }
            log(`  ✓ Deleted: ${item.relativePath}`, 'green');
            deleted++;
        } catch (err) {
            log(`  ✗ Failed to delete: ${item.relativePath} (${err.message})`, 'red');
            failed++;
        }
    }
    
    return { deleted, failed };
}

// Main execution
async function main() {
    const isDryRun = process.argv.includes('--dry-run');
    
    console.clear();
    log('\n🧹 PROJECT CLEANUP SCRIPT', 'bold');
    log(isDryRun ? 'Mode: DRY RUN (no files will be deleted)\n' : 'Mode: CLEANUP (files will be deleted)\n', isDryRun ? 'yellow' : 'red');
    
    // Collect all items to clean
    const allItems = {
        backupFiles: findBackupFiles(),
        buildLogs: findBuildErrorLogs(),
        debugScripts: findUnusedDebugScripts(),
        rootDebug: findRootDebugFiles(),
        statusReports: findStatusReports(),
        oldDocs: findOldDocumentation(),
        unusedFolders: findUnusedFolders()
    };
    
    // Calculate totals
    const totalFiles = Object.values(allItems)
        .filter((_, i) => i < 6) // All except folders
        .reduce((sum, arr) => sum + arr.length, 0);
    
    const totalFolders = allItems.unusedFolders.length;
    
    const totalSize = [
        ...allItems.backupFiles,
        ...allItems.buildLogs,
        ...allItems.debugScripts,
        ...allItems.rootDebug,
        ...allItems.statusReports,
        ...allItems.oldDocs,
        ...allItems.unusedFolders
    ].reduce((sum, item) => sum + item.size, 0);
    
    // Summary
    header('📊 CLEANUP SUMMARY');
    console.log(`Total files to clean: ${totalFiles}`);
    console.log(`Total folders to remove: ${totalFolders}`);
    console.log(`Total space to free: ${formatSize(totalSize)}`);
    console.log('');
    
    if (totalFiles === 0 && totalFolders === 0) {
        log('✨ Project is already clean!', 'green');
        return;
    }
    
    if (isDryRun) {
        log('\n⚠️  This was a DRY RUN. No files were deleted.', 'yellow');
        log('Run without --dry-run to actually delete files:', 'yellow');
        log('  node cleanup_project.js', 'cyan');
        return;
    }
    
    // Confirmation
    log('\n⚠️  WARNING: This will permanently delete the files above!', 'red');
    log('Press Ctrl+C to cancel, or wait 5 seconds to proceed...', 'yellow');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Execute cleanup
    header('🗑️  EXECUTING CLEANUP');
    
    let totalDeleted = 0;
    let totalFailed = 0;
    
    // Delete files
    const fileCategories = [
        { name: 'Backup files', items: allItems.backupFiles },
        { name: 'Build logs', items: allItems.buildLogs },
        { name: 'Debug scripts', items: allItems.debugScripts },
        { name: 'Root debug files', items: allItems.rootDebug },
        { name: 'Status reports', items: allItems.statusReports },
        { name: 'Old documentation', items: allItems.oldDocs }
    ];
    
    for (const category of fileCategories) {
        if (category.items.length > 0) {
            console.log(`\n${category.name}:`);
            const result = deleteItems(category.items, 'file');
            totalDeleted += result.deleted;
            totalFailed += result.failed;
        }
    }
    
    // Delete folders
    if (allItems.unusedFolders.length > 0) {
        console.log('\nUnused folders:');
        const result = deleteItems(allItems.unusedFolders, 'folder');
        totalDeleted += result.deleted;
        totalFailed += result.failed;
    }
    
    // Final summary
    header('✅ CLEANUP COMPLETE');
    log(`Successfully deleted: ${totalDeleted} items`, 'green');
    if (totalFailed > 0) {
        log(`Failed to delete: ${totalFailed} items`, 'red');
    }
    log(`Space freed: ${formatSize(totalSize)}`, 'cyan');
}

// Run
main().catch(err => {
    log(`\nScript failed: ${err.message}`, 'red');
    console.error(err.stack);
    process.exit(1);
});
