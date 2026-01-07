const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function auditDatabase() {
    console.log('--- Database Content Audit ---');
    try {
        const stats = {
            Users: await prisma.user.count(),
            Branches: await prisma.branch.count(),
            Customers: await prisma.customer.count(),
            'Machine Sales': await prisma.machineSale.count(),
            Installments: await prisma.installment.count(),
            'Maintenance Requests': await prisma.maintenanceRequest.count(),
            'Inventory Items (Parts)': await prisma.inventoryItem.count(),
            'Payments/Receipts': await prisma.payment.count(),
            'System Logs': await prisma.systemLog.count()
        };

        console.log('AUDIT_RESULT:' + JSON.stringify(stats));

        // Check for some sample customer names to be sure
        if (stats.Customers > 0) {
            const sampleCustomers = await prisma.customer.findMany({
                take: 3,
                select: { client_name: true }
            });
            console.log('Sample Customers:', sampleCustomers.map(c => c.client_name).join(', '));
        }

    } catch (error) {
        console.error('Audit failed:', error);
    }
}

auditDatabase().finally(() => prisma.$disconnect());
