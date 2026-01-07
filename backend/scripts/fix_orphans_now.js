const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fix() {
    // 1. Confirm user branchId
    const users = await prisma.user.findMany({
        where: { displayName: 'ط¹ظ…ط±ظˆ ظƒظ…ط§ظ„' }
    });
    console.log('User ط¹ظ…ط±ظˆ ظƒظ…ط§ظ„ branchId:', users.map(u => u.branchId));

    // 2. Fix currently orphaned installments by inheriting from parent sale
    const orphans = await prisma.installment.findMany({
        where: { branchId: null },
        include: { sale: true }
    });

    console.log(`Found ${orphans.length} orphans to fix.`);

    for (const inst of orphans) {
        if (inst.sale && inst.sale.branchId) {
            await prisma.installment.update({
                where: { id: inst.id },
                data: { branchId: inst.sale.branchId }
            });
            console.log(`Fixed installment ${inst.id} with branchId ${inst.sale.branchId}`);
        } else {
            console.log(`Could not fix installment ${inst.id} - parent sale has no branchId.`);
        }
    }
}

fix().finally(() => prisma.$disconnect());
