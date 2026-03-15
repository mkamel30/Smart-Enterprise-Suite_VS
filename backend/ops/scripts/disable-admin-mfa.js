const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const result = await prisma.user.updateMany({
        where: { email: 'admin@smart.com' },
        data: { mfaEnabled: false }
    });
    console.log(`Updated ${result.count} users. MFA disabled for admin@smart.com`);
}

main().finally(async () => await prisma.$disconnect());
