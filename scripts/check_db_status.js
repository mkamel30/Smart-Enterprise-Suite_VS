const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
    try {
        const userCount = await prisma.user.count();
        const branchCount = await prisma.branch.count();
        console.log('--- Database Verification ---');
        console.log('Provider URL:', process.env.DATABASE_URL);
        console.log('Total Users:', userCount);
        console.log('Total Branches:', branchCount);

        if (userCount > 0) {
            const firstUser = await prisma.user.findFirst({ select: { username: true, role: true } });
            console.log('Sample User:', firstUser.username, `(${firstUser.role})`);
        }
    } catch (err) {
        console.error('Check failed:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

check();
