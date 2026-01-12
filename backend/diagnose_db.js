const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    console.log('--- Database Diagnostics ---');
    const paymentCount = await db.payment.count();
    const saleCount = await db.machineSale.count();
    const branchCount = await db.branch.count();

    console.log(`Payments: ${paymentCount}`);
    console.log(`Machine Sales: ${saleCount}`);
    console.log(`Branches: ${branchCount}`);

    if (paymentCount > 0) {
        const samplePayment = await db.payment.findFirst();
        console.log('Sample Payment:', JSON.stringify(samplePayment, null, 2));
    }

    if (saleCount > 0) {
        const sampleSale = await db.machineSale.findFirst();
        console.log('Sample Sale:', JSON.stringify(sampleSale, null, 2));
    }

    // Check for branchless data or weird branchIds
    const paymentsNoBranch = await db.payment.count({ where: { branchId: null } });
    const salesNoBranch = await db.machineSale.count({ where: { branchId: null } });
    console.log(`Payments with no branchId: ${paymentsNoBranch}`);
    console.log(`Sales with no branchId: ${salesNoBranch}`);
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
