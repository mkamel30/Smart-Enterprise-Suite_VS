const { PrismaClient } = require('@prisma/client');
const path = require('path');

async function main() {
    const dbPath = path.resolve(__dirname, 'prisma/dev.db');
    console.log('Connecting to:', dbPath);

    const db = new PrismaClient({
        datasources: {
            db: {
                url: `file:${dbPath}`
            }
        }
    });

    try {
        const count = await db.user.count();
        console.log('Current User count:', count);

        const adminEmail = 'm.kamel@egyptsmartcards.com';
        const hashedPassword = await require('bcryptjs').hash('123456', 10);

        console.log('Upserting admin user...');
        const user = await db.user.upsert({
            where: { email: adminEmail },
            update: {},
            create: {
                email: adminEmail,
                displayName: 'M. Kamel',
                role: 'SUPER_ADMIN',
                password: hashedPassword,
                uid: 'admin-123',
                createdAt: new Date(),
                updatedAt: new Date()
            }
        });

        console.log('Admin user ready:', user.email, 'with role:', user.role);

        const finalCount = await db.user.count();
        console.log('Final User count:', finalCount);

    } catch (e) {
        console.error('Operation failed:', e);
    } finally {
        await db.$disconnect();
    }
}

main();
