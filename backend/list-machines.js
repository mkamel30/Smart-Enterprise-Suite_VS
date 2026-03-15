const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listAllMachines(bkcode) {
    try {
        const customer = await prisma.customer.findFirst({
            where: { bkcode },
            include: {
                machines: true,
                branch: true
            }
        });

        if (!customer) {
            console.log('Customer not found');
            return;
        }

        console.log(`Customer: ${customer.client_name} (${customer.bkcode})`);
        console.log(`Branch: ${customer.branch?.name}`);
        console.log(`Machines Found: ${customer.machines.length}`);

        customer.machines.forEach((m, i) => {
            console.log(`${i + 1}. Serial: ${m.serialNumber} | Model: ${m.model} | Status: ${m.status}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

listAllMachines('010001');
