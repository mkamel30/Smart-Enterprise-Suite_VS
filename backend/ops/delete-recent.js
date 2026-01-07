// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const db = require('./db');

async function deleteRecentImport() {
    try {
        // Find machines imported in the last 30 minutes
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const machines = await db.warehouseMachine.findMany({
            where: {
                importDate: {
                    gte: thirtyMinutesAgo
                }
            }
        });

        console.log(`تم العثور على ${machines.length} ماكينة في آخر 30 دقيقة:`);
        machines.forEach(m => console.log(`  - ${m.serialNumber} | ${m.status}`));

        if (machines.length === 0) {
            console.log('لا توجد ماكينات للحذف');
            return;
        }

        // Delete logs first
        for (const m of machines) {
            await db.machineMovementLog.deleteMany({ where: { machineId: m.id } });
        }

        // Delete machines
        const deleted = await db.warehouseMachine.deleteMany({
            where: {
                importDate: {
                    gte: thirtyMinutesAgo
                }
            }
        });

        console.log(`\n✅ تم حذف ${deleted.count} ماكينة بنجاح!`);

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.$disconnect();
    }
}

deleteRecentImport();
