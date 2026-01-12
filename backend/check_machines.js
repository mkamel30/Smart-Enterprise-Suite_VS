const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get today's machine movement logs
    const logs = await db.machineMovementLog.findMany({
        where: {
            createdAt: { gte: today }
        },
        orderBy: { createdAt: 'desc' },
        take: 20
    });

    console.log(`=== Machine Movement Logs Today (${logs.length} records) ===\n`);

    logs.forEach((log, i) => {
        console.log(`${i + 1}. Serial: ${log.serialNumber}`);
        console.log(`   Action: ${log.action}`);
        console.log(`   Details: ${log.details?.substring(0, 100)}...`);
        console.log(`   Performed By: ${log.performedBy}`);
        console.log(`   Time: ${log.createdAt.toLocaleString('ar-EG')}`);
        console.log('---');
    });

    // Also get today's imported machines
    const machines = await db.warehouseMachine.findMany({
        where: {
            importDate: { gte: today }
        },
        orderBy: { importDate: 'desc' },
        take: 10,
        include: { branch: { select: { name: true } } }
    });

    console.log(`\n=== Machines Imported Today (${machines.length} records) ===\n`);

    machines.forEach((m, i) => {
        console.log(`${i + 1}. Serial: ${m.serialNumber}`);
        console.log(`   Model: ${m.model || '-'}, Manufacturer: ${m.manufacturer || '-'}`);
        console.log(`   Status: ${m.status}`);
        console.log(`   Branch: ${m.branch?.name || 'N/A'}`);
        console.log(`   Import Date: ${m.importDate?.toLocaleString('ar-EG')}`);
        console.log('---');
    });
}

main().finally(() => db.$disconnect());
