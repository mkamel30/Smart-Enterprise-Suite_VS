const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Force absolute path to DB file
const dbPath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
console.log(`Target Database Path: ${dbPath}`);

if (!fs.existsSync(dbPath)) {
    console.error('❌ Database file NOT FOUND at expected path!');
    process.exit(1);
}

// Override datasource url
const prisma = new PrismaClient({
    datasources: {
        db: {
            url: `file:${dbPath}`
        }
    }
});

async function exportData() {
    try {
        console.log('Starting data export from SQLite...');

        // Test connection
        const count = await prisma.user.count();
        console.log(`Found ${count} users. Connection successful.`);

        const data = {};

        // 1. Independent / Base Models
        console.log('Exporting Branches...');
        data.branches = await prisma.branch.findMany();

        console.log('Exporting Users...');
        data.users = await prisma.user.findMany();

        console.log('Exporting Customers...');
        data.customers = await prisma.customer.findMany();

        console.log('Exporting Machine Parameters...');
        data.machineParameters = await prisma.machineParameter.findMany();

        console.log('Exporting Spare Parts...');
        data.spareParts = await prisma.sparePart.findMany();

        // 2. Dependent Models
        console.log('Exporting Inventory Items...');
        data.inventoryItems = await prisma.inventoryItem.findMany();

        console.log('Exporting POS Machines...');
        data.posMachines = await prisma.posMachine.findMany();

        console.log('Exporting SIM Cards...');
        data.simCards = await prisma.simCard.findMany();

        // 3. Transactions / Requests
        console.log('Exporting Maintenance Requests...');
        data.maintenanceRequests = await prisma.maintenanceRequest.findMany();

        console.log('Exporting Maintenance Approvals...');
        data.maintenanceApprovals = await prisma.maintenanceApproval.findMany();

        console.log('Exporting Repair Vouchers...');
        data.repairVouchers = await prisma.repairVoucher.findMany();

        console.log('Exporting Transfer Orders...');
        data.transferOrders = await prisma.transferOrder.findMany();

        console.log('Exporting Transfer Order Items...');
        data.transferOrderItems = await prisma.transferOrderItem.findMany();

        // 4. Logs & Financials
        console.log('Exporting Payments...');
        data.payments = await prisma.payment.findMany();

        console.log('Exporting System Logs...');
        data.systemLogs = await prisma.systemLog.findMany();

        console.log('Exporting Machine Movement Logs...');
        data.machineMovementLogs = await prisma.machineMovementLog.findMany();

        console.log('Exporting Stock Movements...');
        data.stockMovements = await prisma.stockMovement.findMany();

        console.log('Exporting Price Change Logs...');
        data.priceChangeLogs = await prisma.priceChangeLog.findMany();

        console.log('Exporting Used Part Logs...');
        data.usedPartLogs = await prisma.usedPartLog.findMany();

        // 5. Auth Security
        console.log('Exporting Password Histories...');
        data.passwordHistories = await prisma.passwordHistory.findMany();

        console.log('Exporting Account Lockouts...');
        data.accountLockouts = await prisma.accountLockout.findMany();

        // Write to file
        const backupPath = path.join(__dirname, '..', 'backups', 'sqlite_export.json');

        // Ensure directory exists
        const backupDir = path.dirname(backupPath);
        if (!fs.existsSync(backupDir)) {
            fs.mkdirSync(backupDir, { recursive: true });
        }

        fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));

        console.log(`\n✅ Data export completed successfully!`);
        console.log(`📁 File saved to: ${backupPath}`);

    } catch (error) {
        console.error('❌ Export failed:', error);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

exportData();
