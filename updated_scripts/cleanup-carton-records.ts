
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

(async () => {
    try {
        console.log('Starting cleanup of carton CR-002 and its contents...');
        const cartonCode = 'CR-002';

        // 1. Find the carton
        const carton = await prisma.adminStoreCarton.findUnique({
            where: { cartonCode }
        });

        if (!carton) {
            console.log(`Carton ${cartonCode} not found in database.`);
        } else {
            console.log(`Found carton: ${cartonCode} (ID: ${carton.id}) with expected count: ${carton.machinesCount}`);

            // 2. Find assets
            const assets = await prisma.adminStoreAsset.findMany({
                where: { cartonCode }
            });
            console.log(`Found ${assets.length} assets linked to this carton.`);

            if (assets.length > 0) {
                const assetIds = assets.map(a => a.id);

                // Delete movements
                const moveDelete = await prisma.adminStoreMovement.deleteMany({
                    where: { assetId: { in: assetIds } }
                });
                console.log(`Deleted ${moveDelete.count} movement records.`);

                // Delete assets
                const assetDelete = await prisma.adminStoreAsset.deleteMany({
                    where: { cartonCode }
                });
                console.log(`Deleted ${assetDelete.count} asset records.`);
            }

            // 3. Delete carton
            await prisma.adminStoreCarton.delete({
                where: { cartonCode }
            });
            console.log(`Successfully deleted carton record ${cartonCode}.`);
        }

    } catch (error) {
        console.error('Error during cleanup:', error);
    } finally {
        await prisma.$disconnect();
    }
})();
