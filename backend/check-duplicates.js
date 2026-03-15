const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkDuplicates(bkcode) {
    try {
        const customers = await prisma.customer.findMany({
            where: { bkcode },
            include: { branch: true, machines: true }
        });

        console.log(`Found ${customers.length} customers with bkcode ${bkcode}:`);
        customers.forEach(c => {
            console.log(`- ID: ${c.id}`);
            console.log(`  Name: ${c.client_name}`);
            console.log(`  Branch: ${c.branch?.name} (${c.branch?.id})`);
            console.log(`  Machines: ${c.machines.length}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

checkDuplicates('010001');
