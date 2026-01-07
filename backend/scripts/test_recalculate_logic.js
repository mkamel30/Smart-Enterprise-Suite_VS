const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const fs = require('fs');

async function simulateRecalculate() {
    const lastOrphan = await prisma.installment.findFirst({
        where: { branchId: null }
    });

    if (!lastOrphan) {
        console.log('No orphaned installments found.');
        return;
    }

    const saleId = lastOrphan.saleId;
    const sale = await prisma.machineSale.findUnique({
        where: { id: saleId },
        include: { installments: true }
    });

    const userBranchId = null;
    const targetBranchId = userBranchId || (sale ? sale.branchId : null);

    const output = {
        saleId,
        sale,
        userBranchId,
        targetBranchId
    };
    fs.writeFileSync('recalculate_test.json', JSON.stringify(output, null, 2));
    console.log('Done.');
}

simulateRecalculate().finally(() => prisma.$disconnect());
