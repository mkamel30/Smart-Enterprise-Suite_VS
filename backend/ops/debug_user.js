// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function check() {
    const user = await db.user.findFirst({
        where: { displayName: { contains: 'عصام جمال' } }
    });
    console.log('User:', JSON.stringify(user, null, 2));

    const branches = await db.branch.findMany();
    console.log('Branches:', JSON.stringify(branches, null, 2));

    const machines = await db.warehouseMachine.count();
    console.log('Total Warehouse Machines:', machines);

    const machineSample = await db.warehouseMachine.findMany({ take: 5 });
    console.log('Machine Sample:', JSON.stringify(machineSample, null, 2));
}

check().catch(console.error).finally(() => db.$disconnect());
