// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function check() {
    const warehouseMachines = await db.warehouseMachine.count();
    const posMachines = await db.posMachine.count();
    const sales = await db.machineSale.count();
    const customers = await db.customer.count();
    const branches = await db.branch.count();
    const users = await db.user.count();

    console.log('--- Database Stats ---');
    console.log('Warehouse Machines:', warehouseMachines);
    console.log('Deployed POS Machines:', posMachines);
    console.log('Machine Sales:', sales);
    console.log('Customers:', customers);
    console.log('Branches:', branches);
    console.log('Users:', users);

    const me = await db.user.findFirst({
        where: { displayName: { contains: 'عصام جمال' } }
    });
    console.log('\nLogged User Profile:', JSON.stringify(me, null, 2));
}

check().catch(console.error).finally(() => db.$disconnect());
