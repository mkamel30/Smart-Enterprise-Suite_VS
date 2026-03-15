const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getBranchFilter } = require('./middleware/permissions');
const { isGlobalRole } = require('./utils/constants');
const { contextStore } = require('./utils/context');

async function debugCounts() {
    const userOr = {
        id: 'cmlinbpiu001ewuz3zxwj4ax5', // احمد الفخراني
        role: 'CS_SUPERVISOR',
        branchId: 'cmlhopjdk000dnh2ahrucbchi',
        displayName: 'احمد الفخراني'
    };

    // Simulate the context middleware
    await contextStore.run({ user: userOr }, async () => {
        const user = userOr;
        const req = { user, query: {} };

        const branchFilter = getBranchFilter(req);
        const where = { ...branchFilter };

        console.log('--- DEBUG INFO ---');
        console.log('User Role:', user.role);
        console.log('User Branch:', user.branchId);
        console.log('Branch Filter:', JSON.stringify(branchFilter, null, 2));

        const totalRaw = await prisma.warehouseSim.count({ where });
        console.log('Total SIMs in DB for this filter (Raw Prisma):', totalRaw);

        // Now try with the extended client if possible, but let's check groupBy results first
        const statusCounts = await prisma.warehouseSim.groupBy({
            by: ['status'],
            where,
            _count: true
        });

        console.log('Status Counts:', JSON.stringify(statusCounts, null, 2));

        const result = { total: 0, byStatus: {}, byType: {} };
        statusCounts.forEach(c => {
            const count = c._count._all || c._count;
            result.byStatus[c.status] = count;
            result.total += count;
        });

        console.log('Final Result Object:', JSON.stringify(result, null, 2));
    });
    process.exit(0);
}

debugCounts().catch(err => {
    console.error(err);
    process.exit(1);
});
