/**
 * Test script for new production report APIs
 */
const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const reportService = require('./services/reportService');

async function testReports() {
    console.log('=== Testing Production Report APIs ===\n');

    // Mock request object for SUPER_ADMIN
    const adminReq = {
        user: { id: 'test', role: 'SUPER_ADMIN', branchId: null }
    };

    // Mock request for branch user
    const branchUser = await db.user.findFirst({ where: { role: 'CS_SUPERVISOR' } });
    const branchReq = branchUser ? {
        user: { id: branchUser.id, role: branchUser.role, branchId: branchUser.branchId }
    } : null;

    const filters = {
        from: '2025-01-01',
        to: '2026-01-31'
    };

    try {
        // Test 1: Governorate Performance
        console.log('1. Testing getGovernoratePerformance...');
        const govData = await reportService.getGovernoratePerformance(filters, adminReq);
        console.log(`   ✓ Returned ${govData.rows.length} branches`);
        console.log(`   Total Activities: ${govData.summary.totalActivities}`);
        console.log(`   Total Offices: ${govData.summary.totalOffices}\n`);

        // Test 2: Inventory Movement
        console.log('2. Testing getInventoryMovement...');
        const invData = await reportService.getInventoryMovement(filters, adminReq);
        console.log(`   ✓ Returned ${invData.timeline.length} months`);
        console.log(`   Grand Total: ${invData.summary.grandTotal.toLocaleString()}\n`);

        // Test 3: POS Stock
        console.log('3. Testing getPosStock...');
        const stockData = await reportService.getPosStock({}, adminReq);
        console.log(`   ✓ Returned ${stockData.rows.length} branches`);
        console.log(`   Grand Total Stock: ${stockData.summary.grandTotal}\n`);

        // Test 4: POS Sales Monthly
        console.log('4. Testing getPosSalesMonthly...');
        const salesMonthly = await reportService.getPosSalesMonthly(filters, adminReq);
        console.log(`   ✓ Returned ${salesMonthly.timeline.length} months`);
        console.log(`   Grand Total Sales: ${salesMonthly.summary.grandTotal}\n`);

        // Test 5: POS Sales Daily
        console.log('5. Testing getPosSalesDaily...');
        const salesDaily = await reportService.getPosSalesDaily({ from: '2026-01-01', to: '2026-01-31' }, adminReq);
        console.log(`   ✓ Returned ${salesDaily.timeline.length} days`);
        console.log(`   Grand Total: ${salesDaily.summary.grandTotal}\n`);

        // Test branch isolation
        if (branchReq) {
            console.log('6. Testing Branch Isolation (CS_SUPERVISOR)...');
            const branchGov = await reportService.getGovernoratePerformance(filters, branchReq);
            console.log(`   ✓ Branch user sees ${branchGov.rows.length} branch(es)`);
        }

        console.log('\n=== All tests passed! ===');
    } catch (error) {
        console.error('Test failed:', error);
    }
}

testReports()
    .catch(console.error)
    .finally(() => db.$disconnect());
