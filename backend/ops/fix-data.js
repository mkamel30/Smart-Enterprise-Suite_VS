// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const db = require('./db');

async function fixMissingSnapshots() {
    console.log('🔧 Starting data repair...');

    try {
        // 1. Fix Customer Names
        const requestsWithoutCustomerName = await db.maintenanceRequest.findMany({
            where: {
                customerName: null,
                customerId: { not: null }
            },
            include: { customer: true }
        });

        console.log(`Found ${requestsWithoutCustomerName.length} requests missing Customer Name.`);

        for (const req of requestsWithoutCustomerName) {
            if (req.customer) {
                await db.maintenanceRequest.update({
                    where: { id: req.id },
                    data: { customerName: req.customer.client_name }
                });
            }
        }

        // 2. Fix Machine Details
        const requestsWithoutMachineDetails = await db.maintenanceRequest.findMany({
            where: {
                OR: [
                    { machineModel: null },
                    { machineManufacturer: null },
                    { serialNumber: null }
                ],
                posMachineId: { not: null }
            },
            include: { posMachine: true }
        });

        console.log(`Found ${requestsWithoutMachineDetails.length} requests missing Machine Details.`);

        for (const req of requestsWithoutMachineDetails) {
            if (req.posMachine) {
                await db.maintenanceRequest.update({
                    where: { id: req.id },
                    data: {
                        machineModel: req.machineModel || req.posMachine.model,
                        machineManufacturer: req.machineManufacturer || req.posMachine.manufacturer,
                        serialNumber: req.serialNumber || req.posMachine.serialNumber
                    }
                });
            }
        }

        console.log('✅ Data repair completed successfully.');

    } catch (error) {
        console.error('Repair failed:', error);
    } finally {
        await db.$disconnect();
    }
}

fixMissingSnapshots();
