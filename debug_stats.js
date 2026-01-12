const db = require('./backend/db');
const { ensureBranchWhere } = require('./backend/prisma/branchHelpers');

async function testStats() {
    process.env.DEBUG = ''; // Silence some logs
    try {
        const req = { user: { role: 'MANAGEMENT', branchId: null } };
        const now = new Date();
        const startOfDay = new Date(new Date().setHours(0, 0, 0, 0));
        const startOfWeek = new Date(new Date().setDate(now.getDate() - now.getDay()));
        startOfWeek.setHours(0, 0, 0, 0);
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const getStatsForRange = async (startDate) => {
            const baseWhere = { createdAt: { gte: startDate } };
            const [open, inProgress, closed] = await Promise.all([
                db.maintenanceRequest.count(ensureBranchWhere({ where: { ...baseWhere, status: { in: ['Open', 'Pending'] } } }, req)),
                db.maintenanceRequest.count(ensureBranchWhere({ where: { ...baseWhere, status: 'In Progress' } }, req)),
                db.maintenanceRequest.count(ensureBranchWhere({ where: { ...baseWhere, status: 'Closed' } }, req))
            ]);
            return { open, inProgress, closed, total: open + inProgress + closed };
        };

        const results = {
            day: await getStatsForRange(startOfDay),
            week: await getStatsForRange(startOfWeek),
            month: await getStatsForRange(startOfMonth),
            allTime: await db.maintenanceRequest.count(ensureBranchWhere({}, req))
        };

        console.log('RESULTS_START');
        console.log(JSON.stringify(results, null, 2));
        console.log('RESULTS_END');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.$disconnect();
    }
}

testStats();
