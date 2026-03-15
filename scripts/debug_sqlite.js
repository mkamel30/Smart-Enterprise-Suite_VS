const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    try {
        const rawTables = await prisma.$queryRaw`SELECT name FROM sqlite_master WHERE type='table'`;
        console.log('Tables:', rawTables);
    } catch (e) {
        console.error('Error listing tables:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
