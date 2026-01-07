// Scan all routes for ensureBranchWhere usage on models without branchId
const fs = require('fs');
const path = require('path');

// Models that DON'T have branchId field
const modelsWithoutBranchId = [
    'Branch',
    'SparePart',
    'User',
    'ClientType',
    'MachineParameter',
    'SystemLog',           // Has branchId but might be queried globally
    'SimMovementLog',      // Has branchId
    'MachineMovementLog',  // Has branchId
    'StockMovement',       // Has branchId
    'RolePermission'       // No branchId
];

// Models that HAVE branchId and should use ensureBranchWhere
const modelsWithBranchId = [
    'Customer',
    'InventoryItem',
    'MaintenanceRequest',
    'TransferOrder',
    'Payment',
    'PendingPayment',
    'Notification',
    'PosMachine',
    'WareouseMachine',
    'ServiceAssignment',
    'ServiceApprovalRequest',
    'MaintenanceApproval'
];

function findIssues(filePath) {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.split('\n');
    const issues = [];
    
    lines.forEach((line, index) => {
        // Check for ensureBranchWhere usage
        if (line.includes('ensureBranchWhere')) {
            // Extract model name from patterns like: db.branch.findMany
            const modelMatch = line.match(/db\.(\w+)\./);
            if (modelMatch) {
                const modelName = modelMatch[1];
                // Capitalize first letter
                const capitalizedModel = modelName.charAt(0).toUpperCase() + modelName.slice(1);
                
                if (modelsWithoutBranchId.includes(capitalizedModel)) {
                    issues.push({
                        line: index + 1,
                        model: capitalizedModel,
                        content: line.trim(),
                        type: 'WRONG_MODEL'
                    });
                }
            }
        }
        
        // Check for TransferOrder without __allow_unscoped
        if (line.includes('db.transferOrder') && !content.includes('__allow_unscoped')) {
            issues.push({
                line: index + 1,
                content: line.trim(),
                type: 'MISSING_UNSCOPED'
            });
        }
    });
    
    return issues;
}

function scanRoutes() {
    const routesDir = path.join(__dirname, 'routes');
    const files = fs.readdirSync(routesDir).filter(f => f.endsWith('.js'));
    
    const results = {};
    
    files.forEach(file => {
        const filePath = path.join(routesDir, file);
        const issues = findIssues(filePath);
        
        if (issues.length > 0) {
            results[file] = issues;
        }
    });
    
    return results;
}

// Run scan
const results = scanRoutes();

console.log('\n📊 SCAN RESULTS\n');
console.log('=' .repeat(80));

let totalIssues = 0;
const filesByModel = {};

Object.entries(results).forEach(([file, issues]) => {
    totalIssues += issues.length;
    
    console.log(`\n📁 ${file} (${issues.length} issues)`);
    console.log('-'.repeat(80));
    
    issues.forEach(issue => {
        if (issue.type === 'WRONG_MODEL') {
            console.log(`  ❌ Line ${issue.line}: ensureBranchWhere on ${issue.model} (no branchId field)`);
            console.log(`     ${issue.content}`);
            
            if (!filesByModel[issue.model]) {
                filesByModel[issue.model] = [];
            }
            filesByModel[issue.model].push(file);
        } else if (issue.type === 'MISSING_UNSCOPED') {
            console.log(`  ⚠️  Line ${issue.line}: TransferOrder without __allow_unscoped`);
            console.log(`     ${issue.content}`);
        }
    });
});

console.log('\n' + '='.repeat(80));
console.log(`\n📈 SUMMARY: ${totalIssues} total issues found\n`);

if (Object.keys(filesByModel).length > 0) {
    console.log('Models being incorrectly filtered:');
    Object.entries(filesByModel).forEach(([model, files]) => {
        console.log(`  • ${model}: ${[...new Set(files)].join(', ')}`);
    });
}

console.log('\n');
