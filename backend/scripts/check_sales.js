const db = require('../db');

async function checkSalesAndInstallments() {
    try {
        const sales = await db.machineSale.findMany({
            take: 5,
            orderBy: { saleDate: 'desc' },
            include: { installments: true }
        });

        console.log('--- Last 5 Sales ---');
        sales.forEach(s => {
            console.log(`Sale ID: ${s.id}, BranchID: ${s.branchId}, TotalPrice: ${s.totalPrice}, Installments Count: ${s.installments.length}`);
            const nullBranchInsts = s.installments.filter(i => i.branchId === null);
            if (nullBranchInsts.length > 0) {
                console.log(`  ALERT: ${nullBranchInsts.length} installments have NULL branchId!`);
            }
        });
    } catch (error) {
        console.error(error);
    } finally {
        await db.$disconnect();
    }
}

checkSalesAndInstallments();
