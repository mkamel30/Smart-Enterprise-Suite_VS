const db = require('../db');

async function countOrphans() {
    try {
        const sales = await db.machineSale.count({
            where: { branchId: null }
        });
        const installments = await db.installment.count({
            where: { branchId: null }
        });
        console.log(`Orphaned Sales: ${sales}`);
        console.log(`Orphaned Installments: ${installments}`);
    } catch (e) {
        console.error(e);
    } finally {
        await db.$disconnect();
    }
}

countOrphans();
