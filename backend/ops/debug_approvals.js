// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const db = require('./db');

async function debugData() {
    console.log('--- Branches ---');
    const branches = await db.branch.findMany();
    console.log(JSON.stringify(branches, null, 2));

    console.log('--- Warehouse Machines ---');
    const machines = await db.warehouseMachine.findMany({
        where: { serialNumber: { in: ['233000000', '3C782000'] } }
    });
    console.log(JSON.stringify(machines, null, 2));

    console.log('--- Maintenance Requests ---');
    const requests = await db.maintenanceRequest.findMany({
        where: { serialNumber: { in: ['233000000', '3C782000'] } }
    });
    console.log(JSON.stringify(requests, null, 2));
}

debugData()
    .catch(console.error)
    .finally(() => db.$disconnect());
