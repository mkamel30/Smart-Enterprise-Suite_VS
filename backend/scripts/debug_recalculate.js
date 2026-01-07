const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function debug() {
    const orphans = await prisma.installment.findMany({
        where: { branchId: null },
        include: { sale: true }
    });

    console.log(`Found ${orphans.length} orphans.`);

    for (const inst of orphans) {
        console.log(`Installment ID: ${inst.id}, Amount: ${inst.amount}`);
        console.log(`Parent Sale ID: ${inst.saleId}, Sale BranchId: ${inst.sale?.branchId}`);
        const customer = await prisma.customer.findUnique({
            where: { bkcode: inst.sale?.customerId }
        });
        console.log(`Customer BranchId: ${customer?.branchId}`);
        console.log('---');
    }

    const users = await prisma.user.findMany({
        select: { id: true, displayName: true, branchId: true }
    });
    console.log('Users:', JSON.stringify(users, null, 2));
}

debug().finally(() => prisma.$disconnect());
