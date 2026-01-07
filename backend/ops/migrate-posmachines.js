// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

// Migration script to copy PosMachine data to ClientPos
// Run with: node migrate-posmachines.js

const { PrismaClient } = require('@prisma/client');
// Guarded raw SQL: use safe wrappers from backend/prisma/safeRaw.js
const { queryRawUnsafeSafe, executeRawUnsafeSafe } = require('../prisma/safeRaw');

async function migrateMachines() {
    const prisma = new PrismaClient();

    console.log('🔄 Starting PosMachine → ClientPos migration...');

    try {
        // Create ClientPos table if not exists
        console.log('📝 Creating ClientPos table...');
        await executeRawUnsafeSafe(`
            CREATE TABLE IF NOT EXISTS "ClientPos" (
                "id" TEXT NOT NULL PRIMARY KEY,
                "serialNumber" TEXT NOT NULL,
                "posId" TEXT,
                "model" TEXT,
                "manufacturer" TEXT,
                "customerId" TEXT,
                "isMain" INTEGER DEFAULT 0,
                CONSTRAINT "ClientPos_serialNumber_key" UNIQUE ("serialNumber")
            )
        `);
        console.log('✅ ClientPos table ready.');

        // Check if PosMachine table exists and has data
        let machineCount = 0;
        try {
            const result = await queryRawUnsafeSafe('SELECT COUNT(*) as count FROM PosMachine');
            machineCount = Number(result[0].count);
            console.log(`📊 Found ${machineCount} records in PosMachine table.`);
        } catch (e) {
            console.log('⚠️ PosMachine table not found or empty. Nothing to migrate.');
            return;
        }

        if (machineCount === 0) {
            console.log('✅ No records to migrate.');
            return;
        }

        // Copy data from PosMachine to ClientPos
        console.log('📋 Copying data from PosMachine to ClientPos...');

        await executeRawUnsafeSafe(`
            INSERT OR IGNORE INTO ClientPos (id, serialNumber, posId, model, manufacturer, customerId, isMain)
            SELECT id, serialNumber, posId, model, manufacturer, customerId, isMain
            FROM PosMachine
        `);

        console.log(`✅ Copied records to ClientPos.`);

        // Verify
        const newCount = await queryRawUnsafeSafe('SELECT COUNT(*) as count FROM ClientPos');
        console.log(`📊 ClientPos now has ${Number(newCount[0].count)} records.`);

        console.log('\n✅ Migration complete!');
        console.log('📌 Now run: npx prisma db push');
        console.log('   When asked about dropping PosMachine table, choose Y');

    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        await prisma.$disconnect();
    }
}

migrateMachines();
