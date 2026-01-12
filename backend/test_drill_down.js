const db = require('./db');

async function testBranchDrillDown() {
    const branchId = 'cmk4dx79m0000vk799scjezkg'; // Valid branch ID
    console.log(`Testing Drill-down for Branch: ${branchId}\n`);

    try {
        const today = new Date();
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
        const threeMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 2, 1);

        console.log('1. Fetching branch basic info...');
        const branch = await db.branch.findUnique({
            where: { id: branchId },
            select: { id: true, name: true, code: true, type: true }
        });
        console.log('   ✓ Branch:', branch?.name);

        console.log('\n2. Fetching revenue...');
        const currentMonthRevenue = await db.payment.aggregate({
            where: { branchId, createdAt: { gte: startOfMonth } },
            _sum: { amount: true }
        });
        console.log('   ✓ Revenue:', currentMonthRevenue._sum.amount || 0);

        console.log('\n3. Testing groupBy tech performance...');
        const techPerformance = await db.maintenanceRequest.groupBy({
            by: ['closingUserName'],
            where: {
                branchId,
                status: 'Closed',
                closingTimestamp: { gte: startOfMonth },
                closingUserName: { not: null }
            },
            _count: { id: true },
            _sum: { totalCost: true }
        });
        console.log('   ✓ Techs found:', techPerformance.length);

        console.log('\n4. Testing top customers query...');
        const topCustomers = await db.customer.findMany({
            where: { branchId },
            select: {
                id: true,
                client_name: true,
                bkcode: true,
                _count: { select: { machines: true } }
            },
            orderBy: { client_name: 'asc' },
            take: 10
        });
        console.log('   ✓ Customers found:', topCustomers.length);
        if (topCustomers.length > 0) {
            console.log('   Sample mapping check (c.name vs c.client_name):');
            console.log('   c.client_name:', topCustomers[0].client_name);
            console.log('   c.name (incorrect):', topCustomers[0].name);
        }

        console.log('\n5. Simulating full response object creation...');
        const responseData = {
            branch,
            revenue: { currentMonth: 0, byType: [], trend: [] },
            requests: { total: 0, distribution: {}, closedCount: 0, avgResolutionDays: 0, closureRate: 0 },
            inventory: { total: 0, lowStockCount: 0, outOfStockCount: 0, lowStockItems: [], outOfStockItems: [] },
            team: { total: 0, active: 0, byRole: { technicians: 0, supervisors: 0 }, topPerformers: [] },
            topCustomers: topCustomers.map(c => ({
                id: c.id,
                name: c.name, // The bug is here
                bkcode: c.bkcode,
                machineCount: c._count.machines
            })),
            recentActivity: []
        };
        console.log('   ✓ Response object created successfully');
        console.log('   Response first customer name:', responseData.topCustomers[0]?.name);

    } catch (error) {
        console.error('CRASH DETECTED:', error.message);
        console.error(error.stack);
    }

    process.exit(0);
}

testBranchDrillDown();
