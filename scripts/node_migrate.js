const { PrismaClient } = require('@prisma/client');
const Database = require('better-sqlite3');
const path = require('path');

// 1. Setup Connections
const sqlitePath = path.resolve(__dirname, '..', 'prisma', 'dev.db');
console.log(`📂 Opening SQLite DB: ${sqlitePath}`);
const sqlite = new Database(sqlitePath, { readonly: true });

const prisma = new PrismaClient();

// Helper to convert SQLite dates (int/string) to JS Date
function parseDate(val) {
    if (!val) return null;
    // Check if it's a number (timestamp)
    if (typeof val === 'number') {
        // Assume milliseconds (e.g., 1765...) if huge, else seconds?
        // 1765794298015 is definitely ms (2025).
        return new Date(val);
    }
    // Try parsing string
    const d = new Date(val);
    if (isNaN(d.getTime())) {
        console.warn(`⚠️ Invalid date found: ${val}, returning null`);
        return null;
    }
    return d;
}

// Generic migration function
async function migrateTable(sqliteTable, prismaModel, mapFn = (x) => x) {
    console.log(`Migrating ${sqliteTable} -> ${prismaModel}...`);
    try {
        const rows = sqlite.prepare(`SELECT * FROM "${sqliteTable}"`).all();
        console.log(`Found ${rows.length} rows in ${sqliteTable}`);

        if (rows.length === 0) return;

        // Transform rows
        const data = rows.map(row => {
            const newRow = { ...row };

            // Check for date fields and convert
            for (const key in newRow) {
                if (key.endsWith('At') || key.endsWith('Date') || key === 'timestamp' || key === 'date') {
                    newRow[key] = parseDate(newRow[key]);
                }
                // Convert boolean integers (0/1) to boolean if Prisma expects bool?
                // Better to let Prisma handle it? No, Prisma strict on types.
                // We'll rely on mapFn for specific fixes.
            }
            return mapFn(newRow);
        });

        // Batch insert
        // Use createMany (skip duplicates to be safe?)
        await prisma[prismaModel].createMany({
            data: data,
            skipDuplicates: true
        });
        console.log(`✅ Success: ${sqliteTable}`);
    } catch (e) {
        console.error(`❌ Failed migrating ${sqliteTable}:`, e.message);
        // Don't exit, try next table?
        // If strict FKs, might fail later.
    }
}

async function main() {
    try {
        console.log('🚀 Starting Node.js Migration...');

        // 1. Branches (Root dependency)
        await migrateTable('Branch', 'branch');

        // 2. SpareParts
        await migrateTable('SparePart', 'sparePart', (row) => ({
            ...row,
            defaultCost: parseFloat(row.defaultCost), // Ensure float
            defaultPrice: parseFloat(row.defaultPrice)
        }));

        // 3. Customers
        await migrateTable('Customer', 'customer', (row) => ({
            ...row,
            // operating_date and papers_date are dates
            operating_date: parseDate(row.operating_date),
            papers_date: parseDate(row.papers_date)
        }));

        // 4. Users
        await migrateTable('User', 'user');

        // 5. PosMachines (Mapped to ClientPos)
        // Note: SQLite table is 'PosMachine' (based on pgloader error) or 'ClientPos'?
        // Let's try 'PosMachine' first. If fail, catch and try 'ClientPos'.
        // Actually, prisma schema had @@map("ClientPos"). 
        // If prisma managed SQLite, the table IS 'ClientPos'.
        // Why did pgloader say 'PosMachine'? 
        // Maybe pgloader used the VIEW name from some internal meta?
        // Let's check which exists.
        let posTable = 'ClientPos';
        try { sqlite.prepare('SELECT 1 FROM ClientPos LIMIT 1').get(); }
        catch { posTable = 'PosMachine'; }

        await migrateTable(posTable, 'posMachine', (row) => {
            // Remap properties if needed
            return row;
        });

        // 6. SimCards (Mapped to ClientSimCard)
        let simTable = 'ClientSimCard';
        try { sqlite.prepare('SELECT 1 FROM ClientSimCard LIMIT 1').get(); }
        catch { simTable = 'SimCard'; }

        await migrateTable(simTable, 'simCard');

        // 7. InventoryItems
        await migrateTable('InventoryItem', 'inventoryItem', (row) => ({
            ...row,
            quantity: parseInt(row.quantity), // int vs bigint
            minLevel: parseInt(row.minLevel)
        }));

        // 8. MachineParameters
        await migrateTable('MachineParameter', 'machineParameter');

        // 9. MaintenanceRequests
        // Add priority if missing (handled by prisma schema update previously)
        await migrateTable('MaintenanceRequest', 'maintenanceRequest', (row) => ({
            ...row,
            cost: row.cost ? parseFloat(row.cost) : null,
            advancePayment: row.advancePayment ? parseFloat(row.advancePayment) : null
        }));

        // 10. UsedPartLog
        await migrateTable('UsedPartLog', 'usedPartLog', (row) => ({
            ...row,
            sellingPrice: parseFloat(row.sellingPrice)
        }));

        // 11. PriceChangeLog
        await migrateTable('PriceChangeLog', 'priceChangeLog', (row) => ({
            ...row,
            oldPrice: parseFloat(row.oldPrice),
            newPrice: parseFloat(row.newPrice),
            oldCost: parseFloat(row.oldCost),
            newCost: parseFloat(row.newCost)
        }));

        // 12. Payments
        await migrateTable('Payment', 'payment', (row) => ({
            ...row,
            amount: parseFloat(row.amount)
        }));

        // 13. SystemLogs
        await migrateTable('SystemLog', 'systemLog');

        // 14. TransferOrder
        await migrateTable('TransferOrder', 'transferOrder');

        // 15. Notification
        await migrateTable('Notification', 'notification');

        console.log('🏁 Migration Finished!');

    } catch (e) {
        console.error('🔥 Fatal Error:', e);
        process.exit(1);
    } finally {
        sqlite.close();
        await prisma.$disconnect();
    }
}

main();
