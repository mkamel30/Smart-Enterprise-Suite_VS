const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Verifying restoration...');
        const userCount = await prisma.user.count();
        const machineCount = await prisma.warehouseMachine.count();

        console.log('--- Database Stats ---');
        console.log(`Users: ${userCount}`);
        console.log(`Machines: ${machineCount}`);

        if (userCount > 1) {
            console.log('✅ Restoration successful (User data found).');
        } else {
            console.log('⚠️ Warning: Only default users found. Restoration might have failed or backup was empty.');
        }

    } catch (e) {
        console.error('Error verification:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
