const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function test() {
    const id = 'cmk5e9jt900047mo278m87s9u';
    try {
        console.log('Trying to delete inventory items for part:', id);
        await db.inventoryItem.deleteMany({
            where: { partId: id }
        });
        console.log('Success');

        console.log('Trying to delete spare part:', id);
        await db.sparePart.delete({ where: { id: id } });
        console.log('Success');
    } catch (error) {
        console.error('Error during deletion:', error);
    } finally {
        await db.$disconnect();
    }
}

test();
