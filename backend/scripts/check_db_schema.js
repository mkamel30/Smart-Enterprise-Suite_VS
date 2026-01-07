const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Guarded raw SQL: use safe wrappers from backend/prisma/safeRaw.js
const { queryRawUnsafeSafe, executeRawUnsafeSafe } = require('../prisma/safeRaw');

async function checkTableInfo() {
    try {
        const result = await queryRawUnsafeSafe(`PRAGMA table_info(MachineSale);`);
        console.log('MachineSale Table Info:', JSON.stringify(result, null, 2));

        const instResult = await queryRawUnsafeSafe(`PRAGMA table_info(Installment);`);
        console.log('Installment Table Info:', JSON.stringify(instResult, null, 2));
    } catch (error) {
        console.error('Error checking table info:', error);
    }
}

checkTableInfo().finally(() => prisma.$disconnect());
