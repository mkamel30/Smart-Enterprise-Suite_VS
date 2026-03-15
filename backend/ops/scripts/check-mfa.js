const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const users = await prisma.user.findMany({
        select: {
            email: true,
            mfaEnabled: true,
            isActive: true,
        }
    });

    console.log('--- MFA STATUS ---');
    users.forEach(u => {
        console.log(`${u.email}: MFA=${u.mfaEnabled}, Active=${u.isActive}`);
    });
}

main().finally(async () => await prisma.$disconnect());
