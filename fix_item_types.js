const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const updated = await prisma.adminStoreItemType.updateMany({
        where: { name: 'بكر حراري' },
        data: { trackingMode: 'QUANTITY_BASED' }
    });
    console.log(`Updated ${updated.count} items.`);

    const all = await prisma.adminStoreItemType.findMany({
        select: { name: true, code: true, trackingMode: true }
    });
    console.log(all);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
