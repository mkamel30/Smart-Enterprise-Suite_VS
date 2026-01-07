const db = require('../db');

async function check() {
    try {
        const sales = await db.machineSale.findMany({
            take: 3,
            orderBy: { saleDate: 'desc' },
            include: { installments: true }
        });

        for (const s of sales) {
            console.log(`SALE: ${s.id} | BRANCH: ${s.branchId}`);
            console.log(`  INST_COUNT: ${s.installments.length}`);
            const nulls = s.installments.filter(i => !i.branchId).length;
            console.log(`  NULL_BRANCH_INSTS: ${nulls}`);
            if (s.installments.length > 0) {
                console.log(`  FIRST_INST_BRANCH: ${s.installments[0].branchId}`);
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await db.$disconnect();
    }
}

check();
