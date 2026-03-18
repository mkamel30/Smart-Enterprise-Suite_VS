const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function test() {
    try {
        const users = await prisma.user.findMany({ select: { id: true, username: true } });
        console.log('--- DATABASE CONNECTION SUCCESS ---');
        console.log(`Common DB Users Count: ${users.length}`);
        if (users.length > 0) {
            console.log(`Sample Username: ${users[0].username}`);
        }
    } catch (error) {
        console.error('--- DATABASE CONNECTION FAILED ---');
        console.error(error);
    } finally {
        await prisma.$disconnect();
    }
}

test();
