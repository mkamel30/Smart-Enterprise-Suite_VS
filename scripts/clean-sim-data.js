const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function cleanup() {
    console.log('--- Starting SIM Data Cleanup ---');
    try {
        // Find WarehouseSim records with type: 'SIM'
        const simsToFix = await prisma.warehouseSim.findMany({
            where: { type: 'SIM' },
            include: { Branch: true }
        });

        console.log(`Found ${simsToFix.length} SIM records with "type: 'SIM'".`);

        let fixedCount = 0;
        for (const sim of simsToFix) {
            // Find corresponding AdminStoreAsset to get the provider
            const asset = await prisma.adminStoreAsset.findUnique({
                where: { serialNumber: sim.serialNumber }
            });

            if (asset && asset.simProvider) {
                console.log(`Fixing SIM ${sim.serialNumber}: Setting type to ${asset.simProvider}`);
                await prisma.warehouseSim.update({
                    where: { id: sim.id },
                    data: { type: asset.simProvider }
                });
                fixedCount++;
            } else {
                console.log(`Could not find provider for SIM ${sim.serialNumber} in AdminStoreAsset.`);
            }
        }

        console.log(`--- Cleanup Finished: Fixed ${fixedCount} records ---`);
    } catch (err) {
        console.error('Error during cleanup:', err);
    } finally {
        await prisma.$disconnect();
    }
}

cleanup();
