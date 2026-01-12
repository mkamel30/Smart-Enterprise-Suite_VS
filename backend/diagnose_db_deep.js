const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    console.log('--- Deep Diagnostics ---');

    // 1. Check current users
    const users = await db.user.findMany({
        select: { id: true, email: true, role: true, branchId: true }
    });
    console.log('Users:', JSON.stringify(users, null, 2));

    // 2. Check inventory
    const inventoryCount = await db.inventoryItem.count();
    const sparePartsWithCost = await db.sparePart.count({ where: { defaultCost: { gt: 0 } } });
    console.log(`Inventory Items: ${inventoryCount}`);
    console.log(`Spare Parts with cost > 0: ${sparePartsWithCost}`);

    // 3. Test the exact projection used in the report
    const startDate = '2026-01-01';
    const endDate = '2026-01-31';
    const dateFilter = {
        gte: new Date(startDate),
        lte: new Date(endDate + 'T23:59:59.999Z')
    };

    const paymentsCount = await db.payment.count({ where: { createdAt: dateFilter } });
    const salesCount = await db.machineSale.count({ where: { saleDate: dateFilter } });

    console.log(`Payments in January 2026: ${paymentsCount}`);
    console.log(`Sales in January 2026: ${salesCount}`);

    // Check inventory items details
    const invItems = await db.inventoryItem.findMany({ include: { part: true } });
    let totalVal = 0;
    invItems.forEach(item => {
        totalVal += item.quantity * (item.part.defaultCost || 0);
    });
    console.log(`Calculated Total Inventory Value: ${totalVal}`);
}

main()
    .catch(console.error)
    .finally(() => db.$disconnect());
