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
        console.log('ط§ط³طھط®ط¯ط§ظ…: node delete-machines.js "SERIAL1,SERIAL2,SERIAL3"');
        console.log('ط£ظˆ ظ„ط­ط°ظپ ط­ط³ط¨ ط§ظ„طھط§ط±ظٹط®: node delete-machines.js --date "2025-12-18"');
        process.exit(1);
    }

    try {
        if (args === '--date') {
            const date = process.argv[3];
            if (!date) {
                console.log('ظٹط±ط¬ظ‰ طھط­ط¯ظٹط¯ ط§ظ„طھط§ط±ظٹط®');
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

            console.log(`طھظ… ط§ظ„ط¹ط«ظˆط± ط¹ظ„ظ‰ ${machines.length} ظ…ط§ظƒظٹظ†ط© ظپظٹ طھط§ط±ظٹط® ${date}:`);
            machines.forEach(m => console.log(`  - ${m.serialNumber}`));

            const confirm = process.argv[4] === '--confirm';
            if (!confirm) {
                console.log('\nظ„ط­ط°ظپ ظ‡ط°ظ‡ ط§ظ„ظ…ط§ظƒظٹظ†ط§طھ ط£ط¶ظپ --confirm ظپظٹ ظ†ظ‡ط§ظٹط© ط§ظ„ط£ظ…ط±');
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

            console.log(`âœ… طھظ… ط­ط°ظپ ${deleted.count} ظ…ط§ظƒظٹظ†ط©`);

        } else {
            const serials = args.split(',').map(s => s.trim());

            console.log(`ط³ظٹطھظ… ط­ط°ظپ ${serials.length} ظ…ط§ظƒظٹظ†ط©...`);

            for (const serial of serials) {
                const machine = await db.warehouseMachine.findUnique({ where: { serialNumber: serial } });
                if (machine) {
                    await db.machineMovementLog.deleteMany({ where: { machineId: machine.id } });
                    await db.warehouseMachine.delete({ where: { serialNumber: serial } });
                    console.log(`âœ… ${serial} - طھظ… ط§ظ„ط­ط°ظپ`);
                } else {
                    console.log(`â‌Œ ${serial} - ط؛ظٹط± ظ…ظˆط¬ظˆط¯`);
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
