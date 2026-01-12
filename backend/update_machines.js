const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
    // Update machines with serial starting with 3D820 imported today to STANDBY
    const result = await db.warehouseMachine.updateMany({
        where: {
            serialNumber: { startsWith: '3D820' },
            status: 'NEW'
        },
        data: {
            status: 'STANDBY' // ماكينات استبدال
        }
    });

    console.log(`✅ Updated ${result.count} machines to STANDBY status`);
}

main().finally(() => db.$disconnect());
