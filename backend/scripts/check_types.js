const db = require('../db');

async function check() {
    try {
        const sales = await db.machineSale.findMany({
            take: 10,
            orderBy: { saleDate: 'desc' }
        });

        for (const s of sales) {
            console.log(`SALE: ${s.id} | BRANCH: "${s.branchId}" | TYPE: ${typeof s.branchId}`);
        }
    } catch (e) {
        console.error(e);
    } finally {
        await db.$disconnect();
    }
}

check();
