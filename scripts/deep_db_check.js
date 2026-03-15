const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function listTables() {
    try {
        const tables = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema='public'`;
        console.log('Tables in Public Schema:', tables.map(t => t.table_name));

        // Check if there is data in any table
        for (const t of tables) {
            const count = await prisma.$queryRawUnsafe(`SELECT count(*) FROM "${t.table_name}"`);
            if (Number(count[0].count) > 0) {
                console.log(`Table ${t.table_name} has ${count[0].count} rows.`);
            }
        }
    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await prisma.$disconnect();
    }
}

listTables();
