const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
const { executiveHandler } = require('./routes/reports');

async function main() {
    // 1. Test Admin (Global)
    console.log('\n--- Simulation: SUPER_ADMIN (Global) ---');
    const adminUser = await db.user.findFirst({ where: { role: 'SUPER_ADMIN' } });
    const reqAdmin = {
        user: { id: adminUser.id, role: adminUser.role, branchId: null, permissions: ['analytics:view:executive'] },
        query: { startDate: '2026-01-01', endDate: '2026-01-31' }
    };
    const resAdmin = {
        json: (data) => console.log('Admin Response Branches:', data.branchPerformance.length),
        status: (code) => ({ json: (data) => console.error(`Admin STATUS ${code}:`, data) })
    };
    await executiveHandler(reqAdmin, resAdmin);

    // 2. Test Supervisor (Branch-specific)
    console.log('\n--- Simulation: CS_SUPERVISOR (Branch cmk4hun7o0005zi19fc6wwlga) ---');
    const branchId = 'cmk4hun7o0005zi19fc6wwlga';
    const supervisorUser = await db.user.findFirst({ where: { role: 'CS_SUPERVISOR', branchId: branchId } });
    if (!supervisorUser) {
        console.log('No CS_SUPERVISOR found for this branch');
    } else {
        const reqSup = {
            user: { id: supervisorUser.id, role: supervisorUser.role, branchId: supervisorUser.branchId, permissions: ['analytics:view:executive'] },
            query: { startDate: '2026-01-01', endDate: '2026-01-31' }
        };
        const resSup = {
            json: (data) => {
                console.log('Supervisor Response Branches:', data.branchPerformance.length);
                console.log('Branches returned:', data.branchPerformance.map(b => b.name));
            },
            status: (code) => ({ json: (data) => console.error(`Supervisor STATUS ${code}:`, data) })
        };
        await executiveHandler(reqSup, resSup);
    }
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
