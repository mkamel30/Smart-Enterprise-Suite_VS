const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '../data_export');

async function exportData() {
    if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR);
    }

    const models = [
        'User', 'Branch', 'Customer', 'ClientType', 'MachineParameter',
        'RolePermission', 'SparePart', 'InventoryItem', 'MaintenanceRequest',
        'StockMovement', 'Payment', 'MachineSale', 'Installment',
        'PosMachine', 'SimCard', 'WarehouseMachine', 'WarehouseSim',
        'TransferOrder', 'TransferOrderItem', 'MaintenanceApproval',
        'RepairVoucher', 'Notification', 'SystemLog', 'ServiceAssignment',
        'ServiceAssignmentLog', 'BranchDebt', 'MaintenanceApprovalRequest',
        'PasswordHistory', 'AccountLockout'
    ];

    console.log('🚀 Starting Data Export for PostgreSQL Migration...');

    for (const model of models) {
        try {
            console.log(`📦 Exporting ${model}...`);
            const data = await prisma[model.charAt(0).toLowerCase() + model.slice(1)].findMany();
            fs.writeFileSync(
                path.join(BACKUP_DIR, `${model}.json`),
                JSON.stringify(data, null, 2)
            );
            console.log(`✅ ${model}: ${data.length} records exported.`);
        } catch (error) {
            console.error(`❌ Error exporting ${model}:`, error.message);
        }
    }

    console.log('\n✨ Export Complete!');
    console.log(`📂 Files saved in: ${BACKUP_DIR}`);
    console.log('\n--- NEXT STEPS ---');
    console.log('1. Update backend/prisma/schema.prisma to use "postgresql" provider.');
    console.log('2. Update backend/.env with your DATABASE_URL (postgresql://...).');
    console.log('3. Run: npx prisma db push');
    console.log('4. Run the import script (to be created) to reload this data.');
}

exportData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
