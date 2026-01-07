const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const bcrypt = require('bcryptjs');

async function resetAdmin() {
    try {
        const user = await prisma.user.findFirst();

        if (!user) {
            console.log('No users found to reset.');
            return;
        }

        console.log(`Updating user: ${user.displayName} (${user.id})`);
        const hashedPassword = await bcrypt.hash('admin1234', 10);

        await prisma.user.update({
            where: { id: user.id },
            data: {
                email: 'admin@system.com',
                password: hashedPassword,
                role: 'SUPER_ADMIN'
            }
        });
        console.log(`Successfully reset password and promoted ${user.displayName} to SUPER_ADMIN with email admin@system.com`);
    } catch (error) {
        console.error('Error resetting password:', error);
    }
}

resetAdmin().finally(() => prisma.$disconnect());
