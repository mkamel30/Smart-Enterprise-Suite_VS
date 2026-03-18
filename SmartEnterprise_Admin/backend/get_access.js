const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
    const u = await prisma.adminUser.findUnique({ where: { username: 'admin' } });
    console.log('--- ADMIN ACCESS INFO ---');
    console.log('Username: admin');
    console.log('Recovery Key:', u.recoveryKey);
    console.log('-------------------------');
}
run().finally(() => prisma.$disconnect());
