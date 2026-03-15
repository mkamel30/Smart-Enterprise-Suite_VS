const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkReceipt(receiptNo) {
    console.log(`Searching for: ${receiptNo}`);

    const tables = [
        'maintenanceRequest',
        'stockMovement',
        'payment',
        'branchDebt',
        'installment',
        'repairVoucher',
        'usedPartLog'
    ];

    for (const tableName of tables) {
        try {
            const model = prisma[tableName];
            if (!model) continue;

            // Map common field names
            let field = 'receiptNumber';
            if (tableName === 'repairVoucher') field = 'code';

            const results = await model.findMany({
                where: { [field]: receiptNo }
            });

            if (results.length > 0) {
                console.log(`MATCH FOUND in [${tableName}]: ${results.length} records`);
                results.forEach((r, i) => {
                    console.log(`  ${i + 1}. ID: ${r.id}`);
                    console.log(`     Branch: ${r.branchId || 'N/A'}`);
                    if (r.createdAt) console.log(`     Date: ${r.createdAt}`);
                    if (r.customerName) console.log(`     Customer: ${r.customerName}`);
                    if (r.serialNumber) console.log(`     Serial: ${r.serialNumber}`);
                    if (r.amount) console.log(`     Amount: ${r.amount}`);
                });
            }
        } catch (e) {
            console.log(`Error checking table ${tableName}: ${e.message}`);
        }
    }
}

const receiptNo = '130220260001';
checkReceipt(receiptNo)
    .catch(e => console.error(e))
    .finally(async () => await prisma.$disconnect());
