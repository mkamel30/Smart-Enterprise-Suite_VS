/**
 * System Verification Script
 * يتحقق من صحة المنطق في صفحة الطلبات
 * Run: node verify_requests_system.js
 */
const db = require('./backend/db');
const { ensureBranchWhere } = require('./backend/prisma/branchHelpers');

async function verify() {
    console.log('='.repeat(60));
    console.log('🔍 SYSTEM VERIFICATION - Requests Page');
    console.log('='.repeat(60));
    console.log();

    // 1. Check total requests in database
    console.log('📊 Step 1: Total Requests in Database');
    const allRequests = await db.maintenanceRequest.findMany({
        where: { _skipBranchEnforcer: true },
        select: { id: true, customerName: true, status: true, branchId: true, createdAt: true }
    });
    console.log(`   Total: ${allRequests.length} requests`);
    allRequests.forEach(r => {
        console.log(`   - ${r.customerName} | Status: ${r.status} | Branch: ${r.branchId?.slice(0, 8)}... | Created: ${r.createdAt.toISOString().slice(0, 10)}`);
    });
    console.log();

    // 2. Check branches
    console.log('📊 Step 2: Branches in System');
    const branches = await db.branch.findMany({ select: { id: true, name: true, type: true } });
    console.log(`   Total: ${branches.length} branches`);
    branches.forEach(b => {
        console.log(`   - ${b.name} (${b.type}) | ID: ${b.id.slice(0, 8)}...`);
    });
    console.log();

    // 3. Simulate stats for a sample branch
    console.log('📊 Step 3: Simulating Stats Calculation');
    const now = new Date();

    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    // Saturday-based week
    const startOfWeek = new Date(now);
    const daysSinceSaturday = (now.getDay() + 1) % 7;
    startOfWeek.setDate(now.getDate() - daysSinceSaturday);
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    startOfMonth.setHours(0, 0, 0, 0);

    console.log(`   Current Time: ${now.toISOString()}`);
    console.log(`   Start of Day: ${startOfDay.toISOString()}`);
    console.log(`   Start of Week (Saturday): ${startOfWeek.toISOString()}`);
    console.log(`   Start of Month: ${startOfMonth.toISOString()}`);
    console.log();

    // Count for each period (global, no branch filter)
    const periods = [
        { name: 'Day', start: startOfDay },
        { name: 'Week', start: startOfWeek },
        { name: 'Month', start: startOfMonth }
    ];

    for (const period of periods) {
        const count = await db.maintenanceRequest.count({
            where: { createdAt: { gte: period.start }, _skipBranchEnforcer: true }
        });
        console.log(`   ${period.name}: ${count} requests`);
    }
    console.log();

    // 4. Check per-branch stats
    console.log('📊 Step 4: Stats Per Branch (Month)');
    for (const branch of branches) {
        const count = await db.maintenanceRequest.count({
            where: {
                createdAt: { gte: startOfMonth },
                branchId: branch.id,
                _skipBranchEnforcer: true
            }
        });
        console.log(`   ${branch.name}: ${count} requests`);
    }
    console.log();

    // 5. Search Test
    console.log('📊 Step 5: Search Test');
    const searchTerm = 'احمد';
    const mockReq = { user: { role: 'SUPER_ADMIN', branchId: null } };

    const searchResults = await db.maintenanceRequest.findMany(ensureBranchWhere({
        where: {
            OR: [
                { customerName: { contains: searchTerm } },
                { serialNumber: { contains: searchTerm } },
                { complaint: { contains: searchTerm } },
                { customer: { bkcode: { contains: searchTerm } } },
                { customer: { client_name: { contains: searchTerm } } },
                { posMachine: { serialNumber: { contains: searchTerm } } }
            ]
        }
    }, mockReq));

    console.log(`   Search for "${searchTerm}": ${searchResults.length} results`);
    searchResults.forEach(r => {
        console.log(`   - ${r.customerName} (Serial: ${r.serialNumber || 'N/A'})`);
    });
    console.log();

    console.log('='.repeat(60));
    console.log('✅ VERIFICATION COMPLETE');
    console.log('='.repeat(60));

    process.exit(0);
}

verify().catch(e => {
    console.error('❌ Verification failed:', e.message);
    process.exit(1);
});
