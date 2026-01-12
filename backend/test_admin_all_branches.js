const db = require('./db');

async function testAdminAllBranches() {
    console.log('=== Testing Admin All-Branches Access ===\n');

    try {
        // Test 1: BranchDebt with _skipBranchEnforcer
        console.log('1. Testing BranchDebt with _skipBranchEnforcer...');
        const debts = await db.branchDebt.findMany({
            where: {
                _skipBranchEnforcer: true,
                status: 'PENDING_PAYMENT'
            },
            select: { id: true, debtorBranchId: true, remainingAmount: true }
        });
        console.log('   ✓ Found', debts.length, 'BranchDebt records');
        if (debts.length > 0) {
            const branches = [...new Set(debts.map(d => d.debtorBranchId))];
            console.log('   Branches in data:', branches);
        }

        // Test 2: Payment with _skipBranchEnforcer (via ensureBranchWhere)
        console.log('\n2. Testing Payment with _skipBranchEnforcer...');
        const payments = await db.payment.findMany({
            where: { _skipBranchEnforcer: true },
            take: 10,
            select: { id: true, branchId: true, amount: true }
        });
        console.log('   ✓ Found', payments.length, 'Payment records');
        if (payments.length > 0) {
            const branches = [...new Set(payments.map(p => p.branchId))];
            console.log('   Branches in data:', branches);
        }

        // Test 3: MaintenanceApprovalRequest with _skipBranchEnforcer
        console.log('\n3. Testing MaintenanceApprovalRequest with _skipBranchEnforcer...');
        const approvals = await db.maintenanceApprovalRequest.count({
            where: {
                _skipBranchEnforcer: true,
                status: 'PENDING'
            }
        });
        console.log('   ✓ Count:', approvals, 'pending approvals');

        // Test 4: Customer with _skipBranchEnforcer
        console.log('\n4. Testing Customer with _skipBranchEnforcer...');
        const customers = await db.customer.count({
            where: { _skipBranchEnforcer: true }
        });
        console.log('   ✓ Count:', customers, 'customers');

        // Test 5: PosMachine with customers 
        console.log('\n5. Testing PosMachine (machines with customers)...');
        const machines = await db.posMachine.count({
            where: {
                _skipBranchEnforcer: true,
                customerId: { not: null }
            }
        });
        console.log('   ✓ Count:', machines, 'POS machines with customers');

        console.log('\n=== All tests passed! ===');

    } catch (error) {
        console.error('ERROR:', error.message);
        console.error('Stack:', error.stack);
    }

    process.exit(0);
}

testAdminAllBranches();
