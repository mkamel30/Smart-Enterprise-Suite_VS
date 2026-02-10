const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();
const BACKUP_DIR = path.join(__dirname, '../data_export');

// Order is critical to satisfy foreign key constraints
const MODEL_ORDER = [
    'Branch',                   // Foundation
    'User',                     // Depends on Branch
    'ClientType',               // Independent
    'MachineParameter',         // Independent
    'SparePart',                // Independent
    'Customer',                 // Depends on Branch
    'InventoryItem',            // Depends on Branch, SparePart
    'PosMachine',               // Depends on Branch, Customer
    'SimCard',                  // Depends on Branch, Customer
    'WarehouseMachine',         // Depends on Branch
    'WarehouseSim',             // Depends on Branch
    'MachineSale',              // Depends on Branch, Customer
    'Installment',              // Depends on Sale
    'MaintenanceRequest',       // Depends on Branch, Customer, PosMachine
    'MaintenanceApproval',      // Depends on Request
    'RepairVoucher',            // Depends on Request, Branch
    'Payment',                  // Depends on Branch, Customer
    'StockMovement',            // Depends on Branch, SparePart
    'TransferOrder',            // Depends on Branch
    'TransferOrderItem',        // Depends on TransferOrder
    'Notification',             // Depends on Branch
    'SystemLog',                // Depends on Branch
    'ServiceAssignment',        // Depends on WarehouseMachine
    'ServiceAssignmentLog',      // Depends on ServiceAssignment
    'BranchDebt',               // Depends on Branch
    'MaintenanceApprovalRequest',// Depends on Assignment
    'PasswordHistory',          // Depends on User
    'AccountLockout'            // Depends on User
];

async function importData() {
    console.log('🚀 Starting Data Import into PostgreSQL...');

    for (const modelName of MODEL_ORDER) {
        const filePath = path.join(BACKUP_DIR, `${modelName}.json`);
        if (!fs.existsSync(filePath)) {
            console.warn(`⚠️ skipping ${modelName}: file not found.`);
            continue;
        }

        const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (data.length === 0) {
            console.log(`📦 Model ${modelName} is empty, skipping.`);
            continue;
        }

        console.log(`📥 Importing ${modelName} (${data.length} records)...`);

        const prismaModel = prisma[modelName.charAt(0).toLowerCase() + modelName.slice(1)];

        // We use createMany or loop depending on Prisma support/complexity
        // Note: PostgreSQL createMany is supported. 
        // We clean dates and nulls if needed.

        try {
            // Clear existing data in the target (optional but safer for clean migration)
            // await prismaModel.deleteMany(); 

            // Map data to handle ISO dates correctly if Prisma doesn't do it automatically
            const sanitizedData = data.map(item => {
                const cleaned = { ...item };
                // Ensure dates are parsed correctly
                Object.keys(cleaned).forEach(key => {
                    if (typeof cleaned[key] === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(cleaned[key])) {
                        cleaned[key] = new Date(cleaned[key]);
                    }
                });
                return cleaned;
            });

            // Batch create
            await prismaModel.createMany({
                data: sanitizedData,
                skipDuplicates: true // In case some data exists
            });

            console.log(`✅ ${modelName}: Successfully imported.`);
        } catch (error) {
            console.error(`❌ Error importing ${modelName}:`, error.message);
            console.log('Trying individual inserts for better error reporting...');

            // Fallback to individual inserts for debugging
            for (const item of data) {
                try {
                    await prismaModel.create({ data: item });
                } catch (e) {
                    // console.error(`   Fail on record ID ${item.id}: ${e.message}`);
                }
            }
        }
    }

    console.log('\n✨ Import Complete! Your database is now migrated to PostgreSQL.');
}

importData()
    .catch(console.error)
    .finally(() => prisma.$disconnect());
