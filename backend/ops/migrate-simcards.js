// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Migration script to copy SimCard data to ClientSimCard
// Run with: node migrate-simcards.js

const { PrismaClient } = require('@prisma/client');
// Guarded raw SQL: use safe wrappers from backend/prisma/safeRaw.js
const { queryRawUnsafeSafe, executeRawUnsafeSafe } = require('../prisma/safeRaw');

async function migrateSimCards() {
    const prisma = new PrismaClient();

    console.log('🔄 Starting SimCard migration...');

    try {
        // Create ClientSimCard table if not exists
        console.log('📝 Creating ClientSimCard table...');
        await executeRawUnsafeSafe(`
            CREATE TABLE IF NOT EXISTS "ClientSimCard" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "serialNumber" TEXT NOT NULL,
                "type" TEXT,
                "customerId" TEXT,
                "assignedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT "ClientSimCard_serialNumber_key" UNIQUE ("serialNumber")
            )
        `);
        console.log('✅ ClientSimCard table ready.');

        // Create SimMovementLog table if not exists
        console.log('📝 Creating SimMovementLog table...');
        await executeRawUnsafeSafe(`
            CREATE TABLE IF NOT EXISTS "SimMovementLog" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "serialNumber" TEXT NOT NULL,
                "action" TEXT NOT NULL,
                "customerId" TEXT,
                "customerName" TEXT,
                "details" TEXT,
                "performedBy" TEXT,
                "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
        `);
        console.log('✅ SimMovementLog table ready.');

        // Check if SimCard table exists and has data
        let simCardCount = 0;
        try {
            const result = await queryRawUnsafeSafe('SELECT COUNT(*) as count FROM SimCard');
            simCardCount = Number(result[0].count);
            console.log(`📊 Found ${simCardCount} records in SimCard table.`);
        } catch (e) {
            console.log('⚠️ SimCard table not found or empty. Nothing to migrate.');
            return;
        }

        if (simCardCount === 0) {
            console.log('✅ No records to migrate.');
            return;
        }

        // Copy data from SimCard to ClientSimCard
        console.log('📋 Copying data from SimCard to ClientSimCard...');

        const copyResult = await executeRawUnsafeSafe(`
            INSERT OR IGNORE INTO ClientSimCard (id, serialNumber, type, customerId, assignedAt)
            SELECT id, serialNumber, type, customerId, datetime('now')
            FROM SimCard
        `);

        console.log(`✅ Copied records to ClientSimCard.`);

        // Verify
        const newCount = await queryRawUnsafeSafe('SELECT COUNT(*) as count FROM ClientSimCard');
        console.log(`📊 ClientSimCard now has ${Number(newCount[0].count)} records.`);

        console.log('\n✅ Migration complete!');
        console.log('📌 Now run: npx prisma db push');
        console.log('   When asked about dropping SimCard table, choose Y (data is safe in ClientSimCard)');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateSimCards();
