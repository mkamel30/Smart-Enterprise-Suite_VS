// MOVED TO backend/ops - guarded execution
// To run: set LEGACY_OPS_ALLOW=1 and optionally DRY_RUN=1 to review behavior
if (process.env.LEGACY_OPS_ALLOW !== '1') {
  console.error('Legacy script is guarded. Set LEGACY_OPS_ALLOW=1 to run.');
  process.exit(1);
}

const db = require('./db');

async function deleteMachines() {
    const args = process.argv[2];

    if (!args) {
        console.log('استخدام: node delete-machines.js "SERIAL1,SERIAL2,SERIAL3"');
        console.log('أو لحذف حسب التاريخ: node delete-machines.js --date "2025-12-18"');
        process.exit(1);
    }

    try {
        if (args === '--date') {
            const date = process.argv[3];
            if (!date) {
                console.log('يرجى تحديد التاريخ');
                process.exit(1);
            }

            const startDate = new Date(date);
            const endDate = new Date(date);
            endDate.setDate(endDate.getDate() + 1);

            const machines = await db.warehouseMachine.findMany({
                where: {
                    importDate: {
                        gte: startDate,
                        lt: endDate
                    }
                }
            });

            console.log(`تم العثور على ${machines.length} ماكينة في تاريخ ${date}:`);
            machines.forEach(m => console.log(`  - ${m.serialNumber}`));

            const confirm = process.argv[4] === '--confirm';
            if (!confirm) {
                console.log('\nلحذف هذه الماكينات أضف --confirm في نهاية الأمر');
                process.exit(0);
            }

            // Delete logs first
            for (const m of machines) {
                await db.machineMovementLog.deleteMany({ where: { machineId: m.id } });
            }

            const deleted = await db.warehouseMachine.deleteMany({
                where: {
                    importDate: {
                        gte: startDate,
                        lt: endDate
                    }
                }
            });

            console.log(`✅ تم حذف ${deleted.count} ماكينة`);

        } else {
            const serials = args.split(',').map(s => s.trim());

            console.log(`سيتم حذف ${serials.length} ماكينة...`);

            for (const serial of serials) {
                const machine = await db.warehouseMachine.findUnique({ where: { serialNumber: serial } });
                if (machine) {
                    await db.machineMovementLog.deleteMany({ where: { machineId: machine.id } });
                    await db.warehouseMachine.delete({ where: { serialNumber: serial } });
                    console.log(`✅ ${serial} - تم الحذف`);
                } else {
                    console.log(`❌ ${serial} - غير موجود`);
                }
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await db.$disconnect();
    }
}

deleteMachines();
