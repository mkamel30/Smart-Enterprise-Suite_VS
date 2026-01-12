const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

// Mock the branch enforcer logic or just see if it fails like before
// Actually, I can just try to run the new logic.

async function test() {
    const id = 'cmk5dnzqb03e1xz9krj1oajs9'; // A part that exists
    try {
        console.log('Trying to delete related records for part:', id);

        await db.priceChangeLog.deleteMany({
            where: { partId: id }
        });
        console.log('PriceChangeLog success');

        await db.stockMovement.deleteMany({
            where: {
                partId: id,
                branchId: { not: 'GLOBAL_DELETE' }
            }
        });
        console.log('StockMovement success');

        await db.inventoryItem.deleteMany({
            where: {
                partId: id,
                branchId: { not: 'GLOBAL_DELETE' }
            }
        });
        console.log('InventoryItem success');

        console.log('Trying to delete spare part:', id);
        await db.sparePart.delete({ where: { id: id } });
        console.log('SparePart success');
    } catch (error) {
        console.error('Error during deletion:', error);
    } finally {
        await db.$disconnect();
    }
}

// Attach branch enforcer manually to the local client to test it
const { attachBranchEnforcer } = require('./prisma/branchEnforcer');
attachBranchEnforcer(db);

test();
