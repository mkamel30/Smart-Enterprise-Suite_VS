const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrate() {
    console.log('ًں”„ Starting migration to Multi-Branch system...');
    console.log('1. Creating Default Branch...');

    let defaultBranch = await prisma.branch.findFirst({ where: { code: 'CAIRO_ARMY' } });

    if (!defaultBranch) {
        defaultBranch = await prisma.branch.create({
            data: {
                code: 'CAIRO_ARMY',
                name: 'ط§ظ„ظ‚ط§ظ‡ط±ط©-ط§ظ„ط¬ظٹط´',
                address: 'ط§ظ„ظ‚ط§ظ‡ط±ط© - ط´ط§ط±ط¹ ط§ظ„ط¬ظٹط´',
                isActive: true
            }
        });
        console.log('âœ… Created branch: ط§ظ„ظ‚ط§ظ‡ط±ط©-ط§ظ„ط¬ظٹط´');
    } else {
        console.log('â„¹ï¸ڈ Branch already exists: ط§ظ„ظ‚ط§ظ‡ط±ط©-ط§ظ„ط¬ظٹط´');
    }

    const branchId = defaultBranch.id;

    console.log('2. Migrating Data...');

    // Customers
    const updateCustomers = await prisma.customer.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateCustomers.count} customers`);

    // Warehouse Machines
    const updateMachines = await prisma.warehouseMachine.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateMachines.count} warehouse machines`);

    // Warehouse SIMs
    const updateSims = await prisma.warehouseSim.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateSims.count} warehouse sims`);

    // Inventory Items
    const updateInventory = await prisma.inventoryItem.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateInventory.count} inventory items`);

    // Maintenance Requests
    const updateRequests = await prisma.maintenanceRequest.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateRequests.count} maintenance requests`);

    // Stock Movements
    const updateMovements = await prisma.stockMovement.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateMovements.count} stock movements`);

    // Machine Sales
    const updateSales = await prisma.machineSale.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateSales.count} machine sales`);

    // Payments
    const updatePayments = await prisma.payment.updateMany({
        where: { branchId: null },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updatePayments.count} payments`);

    // Users
    // Users with role 'Admin' stay null (global), others go to default branch
    const updateUsers = await prisma.user.updateMany({
        where: {
            branchId: null,
            role: { notIn: ['Admin', 'admin', 'ADMIN'] }
        },
        data: { branchId }
    });
    console.log(`âœ… Updated ${updateUsers.count} regular users to branch`);

    console.log('ًںژ‰ Migration completed successfully!');
}

migrate()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
