const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const itemTypes = await prisma.adminStoreItemType.findMany({
        select: { name: true, code: true, trackingMode: true }
    });
    console.log(itemTypes);
}

main()
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
