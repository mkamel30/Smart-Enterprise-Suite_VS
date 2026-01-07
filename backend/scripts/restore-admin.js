const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Restoring admin user...');

        // Delete existing admin if any (to ensure clean slate with known password)
        await prisma.user.deleteMany({
            where: { email: 'admin@system.com' }
        });

        const hashedPassword = await bcrypt.hash('admin', 10);

        await prisma.user.create({
            data: {
                email: 'admin@system.com',
                password: hashedPassword,
                role: 'SUPER_ADMIN',
                displayName: 'System Admin',
                canDoMaintenance: true
            }
        });

        console.log('âœ… Admin restored successfully.');
        console.log('Email: admin@system.com');
        console.log('Password: admin');

    } catch (e) {
        console.error('Error during restoration:', e);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
    }
}

main();
