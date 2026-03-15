const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function quickSearch(serial) {
    try {
        console.log(`--- QUICK SEARCH: ${serial} ---`);

        // 1. MachineMovementLog (Direct column search, should be fast)
        const movements = await prisma.machineMovementLog.findMany({
            where: { serialNumber: serial },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        console.log(`\n--- MachineMovementLog (${movements.length} records) ---`);
        movements.forEach(m => {
            console.log(`[${m.createdAt.toISOString()}] ${m.action} | Branch: ${m.branchId}`);
            console.log(`  Details: ${m.details}`);
        });

        // 2. SystemLog (Search by entityId for MACHINE or POS_MACHINE types)
        const sysLogs = await prisma.systemLog.findMany({
            where: {
                OR: [
                    { entityId: serial },
                    { details: { contains: serial } }
                ]
            },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        console.log(`\n--- SystemLog (${sysLogs.length} records) ---`);
        sysLogs.forEach(l => {
            console.log(`[${l.createdAt.toISOString()}] ${l.action} | Type: ${l.entityType} | ID: ${l.entityId}`);
            console.log(`  Details: ${l.details}`);
        });

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

quickSearch('3C7820010');
