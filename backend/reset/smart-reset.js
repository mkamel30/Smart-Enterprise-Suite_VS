const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// Paths
const DB_PATH = path.join(__dirname, '..', 'prisma', 'dev.db');
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Function to create backup
function createBackup() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `smart_reset_backup_${timestamp}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    console.log(`[BACKUP] Creating safety backup at: ${backupPath}`);

    try {
        fs.copyFileSync(DB_PATH, backupPath);
        console.log('[BACKUP] ✅ Backup created successfully.');
        return true;
    } catch (error) {
        console.error('[BACKUP] ❌ Failed to create backup:', error);
        return false;
    }
}

async function smartReset() {
    console.log('\n🚀 Starting SMART Database Reset...');
    console.log('-----------------------------------');
    console.log('Request: Reset data WITHOUT deleting settings, users, branches, rules, permissions, or parts.');

    // Step 1: Backup
    if (!createBackup()) {
        console.error('⛔ ABORTING: Could not create backup. No data was touched.');
        process.exit(1);
    }

    try {
        // Step 2: Clear Transactional Data
        // Order is important to avoid FK violations (though we could use cascade or disable keys, manual order is safer)

        console.log('\n🧹 Clearing Transactional Tables...');

        // -- Maintenance & Operations --
        await prisma.repairVoucher.deleteMany({});
        console.log('   - RepairVoucher: Cleared');

        await prisma.maintenanceApproval.deleteMany({});
        console.log('   - MaintenanceApproval: Cleared');

        await prisma.maintenanceRequest.deleteMany({}); // This cascades to UsedPartLog (if relation exists) but we delete logs explicitly too
        console.log('   - MaintenanceRequest: Cleared');

        // -- Transfers --
        await prisma.transferOrderItem.deleteMany({});
        console.log('   - TransferOrderItem: Cleared');

        await prisma.transferOrder.deleteMany({});
        console.log('   - TransferOrder: Cleared');

        // -- Logistics & Warehouse --
        await prisma.stockMovement.deleteMany({});
        console.log('   - StockMovement: Cleared');

        await prisma.machineMovementLog.deleteMany({});
        console.log('   - MachineMovementLog: Cleared');

        await prisma.simMovementLog.deleteMany({});
        console.log('   - SimMovementLog: Cleared');

        await prisma.usedPartLog.deleteMany({});
        console.log('   - UsedPartLog: Cleared');

        await prisma.priceChangeLog.deleteMany({});
        console.log('   - PriceChangeLog: Cleared');

        await prisma.warehouseMachine.deleteMany({});
        console.log('   - WarehouseMachine: Cleared');

        await prisma.warehouseSim.deleteMany({});
        console.log('   - WarehouseSim: Cleared');

        // -- Sales & Finance --
        await prisma.installment.deleteMany({});
        console.log('   - Installment: Cleared');

        await prisma.machineSale.deleteMany({});
        console.log('   - MachineSale: Cleared');

        await prisma.payment.deleteMany({});
        console.log('   - Payment: Cleared');

        // -- Customer Assets & Customers --
        // Note: PosMachine & SimCard link to Customer, so delete them first
        await prisma.posMachine.deleteMany({});
        console.log('   - PosMachine (Client Machines): Cleared');

        await prisma.simCard.deleteMany({});
        console.log('   - SimCard (Client SIMs): Cleared');

        await prisma.customer.deleteMany({});
        console.log('   - Customer: Cleared');

        // -- System & Notifications --
        await prisma.notification.deleteMany({});
        console.log('   - Notification: Cleared');

        await prisma.systemLog.deleteMany({});
        console.log('   - SystemLog: Cleared');

        // Step 3: Reset Inventory (Smart Reset)
        // We keep the items (linked to branch & part) but zero the quantity
        // However, we preserve minLevel and location as they are "settings"
        console.log('\n🔄 Resetting Inventory Quantities...');
        const inventoryResult = await prisma.inventoryItem.updateMany({
            data: { quantity: 0 }
        });
        console.log(`   - InventoryItem: ${inventoryResult.count} items reset to 0 quantity (Settings preserved).`);

        console.log('\n✨ SMART RESET COMPLETE ✨');
        console.log('-----------------------------------');
        console.log('✅ PRESERVED DATA:');
        console.log('   - Users & Admins');
        console.log('   - Branches & Hierarchy');
        console.log('   - Spare Parts (Catalog)');
        console.log('   - Machine Parameters (Rules)');
        console.log('   - Permissions');
        console.log('   - Client Types');
        console.log('-----------------------------------');

    } catch (error) {
        console.error('\n❌ ERROR during reset:', error);
        console.log('⚠️  The database might be in a partial state. You can restore from the backup created at start.');
    } finally {
        await prisma.$disconnect();
    }
}

smartReset();
