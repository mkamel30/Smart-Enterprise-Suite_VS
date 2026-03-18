const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const users = await prisma.user.count();
        const branches = await prisma.branch.count();
        const machines = await prisma.posMachine.count();
        console.log('--- MAIN DATABASE STATUS ---');
        console.log('Users:', users);
        console.log('Branches:', branches);
        console.log('Machines:', machines);
    } catch (e) {
        console.error('Error checking main DB:', e.message);
    } finally {
        await prisma.$disconnect();
    }
}
check();
