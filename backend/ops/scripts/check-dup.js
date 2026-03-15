const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
    const r = '130220260001';
    const reqs = await prisma.maintenanceRequest.findMany({ where: { receiptNumber: r } });
    const payments = await prisma.payment.findMany({ where: { receiptNumber: r } });
    const movements = await prisma.stockMovement.findMany({ where: { receiptNumber: r } });

    console.log('--- RECAP ---');
    console.log(`Requests count: ${reqs.length}`);
    reqs.forEach(x => console.log(`   ID: ${x.id}, Branch: ${x.branchId}, Customer: ${x.customerName}`));

    console.log(`Payments count: ${payments.length}`);
    payments.forEach(x => console.log(`   ID: ${x.id}, Branch: ${x.branchId}, Amount: ${x.amount}`));

    console.log(`StockMovements count: ${movements.length}`);
    movements.forEach(x => console.log(`   ID: ${x.id}, Branch: ${x.branchId}, Type: ${x.type}`));
}

run().finally(() => prisma.$disconnect());
