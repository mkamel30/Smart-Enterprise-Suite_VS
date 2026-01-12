const db = require('./backend/db');
const { ensureBranchWhere } = require('./backend/prisma/branchHelpers');

async function testDiagnostics() {
    const req = {
        user: {
            id: 'admin-id',
            role: 'SUPER_ADMIN',
            branchId: null
        }
    };

    console.log('--- Testing Stats (Month) ---');
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const baseWhere = { createdAt: { gte: startOfMonth } };

    try {
        const stats = await Promise.all([
            db.maintenanceRequest.count(ensureBranchWhere({
                where: { ...baseWhere, status: { notIn: ['In Progress', 'Closed'] } }
            }, req)),
            db.maintenanceRequest.count(ensureBranchWhere({
                where: { ...baseWhere, status: 'In Progress' }
            }, req)),
            db.maintenanceRequest.count(ensureBranchWhere({
                where: { ...baseWhere, status: 'Closed' }
            }, req))
        ]);
        console.log('Month Stats [Open, InProgress, Closed]:', stats);
    } catch (e) {
        console.error('Stats failed:', e.message);
    }

    console.log('\n--- Testing Search ("احمد") ---');
    const s = 'احمد';
    const searchWhere = {
        OR: [
            { customerName: { contains: s } },
            { serialNumber: { contains: s } },
            { complaint: { contains: s } },
            { customer: { bkcode: { contains: s } } }
        ]
    };

    try {
        const results = await db.maintenanceRequest.findMany(ensureBranchWhere({
            where: searchWhere,
            take: 5
        }, req));
        console.log('Search Results count:', results.length);
        if (results.length > 0) {
            console.log('First result Name:', results[0].customerName);
        }
    } catch (e) {
        console.error('Search failed:', e.message);
    }

    process.exit(0);
}

testDiagnostics();
