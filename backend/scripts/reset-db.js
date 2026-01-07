const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function resetDatabase() {
    console.log('--- Starting Selective Database Reset ---');

    try {
        // Order matters due to foreign key constraints if they were strictly enforced, 
        // though SQLite is more relaxed unless specified.

        // 1. Clear Maintenance related
        console.log('Cleaning Maintenance Requests, Approvals, and Vouchers...');
        await prisma.maintenanceApproval.deleteMany({});
        await prisma.repairVoucher.deleteMany({});
        await prisma.maintenanceRequest.deleteMany({});

        // 2. Clear Transfers
        console.log('Cleaning Transfer Orders...');
        await prisma.transferOrderItem.deleteMany({});
        await prisma.transferOrder.deleteMany({});

        // 3. Clear Inventory transactions and logs
        console.log('Cleaning Logs and Movements...');
        await prisma.stockMovement.deleteMany({});
        await prisma.priceChangeLog.deleteMany({});
        await prisma.usedPartLog.deleteMany({});
        await prisma.machineMovementLog.deleteMany({});
        await prisma.systemLog.deleteMany({});
        await prisma.payment.deleteMany({});

        // 4. Clear Customers and linked assets
        // Note: PosMachine and SimCard have customerId as FK
        console.log('Cleaning Client Machines and SIM Cards...');
        await prisma.posMachine.deleteMany({});
        await prisma.simCard.deleteMany({});
        console.log('Cleaning Customers...');
        await prisma.customer.deleteMany({});

        // 5. Reset Inventory Quantities to 0 instead of deleting the records (preserving spare part linking)
        console.log('Resetting Inventory Quantities to zero...');
        await prisma.inventoryItem.updateMany({
            data: { quantity: 0 }
        });

        console.log('\n--- Reset Complete! ---');
        console.log('Preserved tables: User, Branch, MachineParameter, SparePart.');

    } catch (error) {
        console.error('Error during database reset:', error);
    } finally {
        await prisma.$disconnect();
    }
}

resetDatabase();
