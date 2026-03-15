const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { getBranchFilter } = require('./middleware/permissions');
const { isGlobalRole } = require('./utils/constants');

async function simulate() {
    const user = {
        id: 'user_id',
        role: 'CS_SUPERVISOR',
        branchId: 'cmlhopjdk000dnh2ahrucbchi',
        displayName: 'Test User'
    };

    const req = {
        user,
        query: {}
    };

    const branchFilter = getBranchFilter(req);
    const where = { ...branchFilter };

    // Logic from core.js
    if (req.query.branchId && (isGlobalRole(req.user.role))) {
        where.branchId = req.query.branchId;
    }

    console.log('Constructed Where:', JSON.stringify(where, null, 2));

    try {
        const [sims, total] = await Promise.all([
            prisma.warehouseSim.findMany({
                where,
                include: { branch: true },
                take: 50,
                skip: 0
            }),
            prisma.warehouseSim.count({ where })
        ]);

        console.log('Results Found:', total);
        if (sims.length > 0) {
            console.log('First Sim:', sims[0].serialNumber, 'Branch:', sims[0].branchId);
        }
    } catch (err) {
        console.error('Error during query:', err);
    }
    process.exit(0);
}

simulate();
