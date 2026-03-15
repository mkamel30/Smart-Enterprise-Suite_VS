const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const companyMachines = await prisma.warehouseMachine.count({ where: { status: 'NEW' } });
        const companySims = await prisma.warehouseSim.count({ where: { status: 'NEW' } });
        console.log(`Company Machines (NEW): ${companyMachines}`);
        console.log(`Company SIMs (NEW): ${companySims}`);
        process.exit(0);
    } catch (e) {
        console.error(e);
        process.exit(1);
    }
}

main();
